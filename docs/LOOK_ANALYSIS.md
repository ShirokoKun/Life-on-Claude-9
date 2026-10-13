# OpenKnight look analysis (multi-frame) vs our round 3

**Method:**
- One frame from the middle of every shot: 74 shots, of which 51 are night shots and the most relevant to us.
- The letterbox is cropped before measuring.
- Every frame gets the same measurements; ours are measured identically.
- Visual sheets: `reference/progress/ref_night_contact.jpg` and `reference/progress/texture_crops_ref_vs_ours.jpg`.

## Numbers: night shots (10th percentile / median / 90th percentile) vs ours

| Measure | Reference night shots | Ours (face / desk 3/4) | Reading |
|---|---|---|---|
| Pure black share of frame | 15 / **40%** / 62 | 0% / 12% | Their darkness is a design element; ours is lifted to grey |
| Median brightness | 0.004 / **0.041** / 0.22 | 0.20 / 0.11 | Our midtones are 3–5× brighter, so nothing feels like night |
| Brightest 0.5% | 0.57 / 0.82 / 0.98 | 0.85 / 0.86 | Similar peaks: they have the range, we waste it on midtones |
| Area that is highlight | **0.3%** of frame | 0.8–0.9% | Their light lives in tiny hot points |
| Saturation of lit pixels | 0.31 / **0.47** / 0.77 | 0.21 / 0.27 | We're half as colourful |
| Highlight colour bias | warm (+0.09) | neutral (−0.01) | Their light sources are warm-tinted |
| Shadow colour bias | varies by shot: violet-blue streets, red cockpit | warm (+0.16 / +0.21) | Our shadows are muddy brown; theirs carry the shot's colour |
| Glow around highlights | 0.45 median, local | 0.65–0.74, global veil | Theirs is a halo; ours is fog |
| Fine noise in flat areas | **2.0** (very consistent) | 2.5–3.4 | Our "gritty" look is measurable: +25–70% speckle |
| In-focus share of frame | **5%** | 7% / 30% | Almost everything is soft in theirs; ours shows every detail |

## What they do (cinematographer's read)
1. **One colour world per shot.**
   - The cockpit is red; the dashboard is cyan-green; the street is violet-blue with sodium amber.
   - Each shot is close to monochrome, plus one accent.
   - We mix lamp-amber, screen-white, wall-brown and teal fog in every shot, which reads muddy.
2. **Light is local; the rest falls to black.**
   - Light pools on the subject and stops.
   - About 40% of every frame is true black negative space, which gives depth and calm.
3. **Glow belongs to sources.**
   - Headlights and lamps bloom into huge soft discs with flare streaks. The air elsewhere stays clear.
   - Bloom intensity follows source brightness, not a global haze.
4. **Surfaces are smooth.**
   - At 1:1, skin is a soft gradient with no pores; walls are flat colour; ground is smooth black.
   - Clean = no micro-texture competing with the light.
   - Our plaster bump, pores, dust specks, volume noise and render noise add the grit that reads cheap.
5. **Shallow focus and motion blur everywhere.**
   - Only ~5% of the frame is sharp: the eye, a hand, a gauge. Backgrounds become bokeh.
   - Blur hides geometry, so simple models look rich.
6. **Faces are carved by one saturated key.**
   - Side or three-quarter key, skin taking the light's colour.
   - Shadow side falls to black; the hair is rim-lit so its silhouette glows.
7. **Camera language:** low angles, slight Dutch tilts, foreground occlusion, flares crossing the frame, the subject small against darkness for scale.

## Rules for our next pass (targets)
- **Values:**
  - black share 30–45%;
  - median brightness 0.04–0.08;
  - highlight area under 1%;
  - saturation 0.4–0.55.
- **Colour per shot:** each 3 AM shot gets one dominant key colour (screen-blue, as in the storyboard), one warm accent (lamp or string lights) and black.
- **Glow:**
  - remove the room haze and mist fog;
  - bloom only above a high threshold, sized by source;
  - halation only around the hot points.
- **Clean surfaces:**
  - plaster bump and dust motes off;
  - skin pores softened at shot distance;
  - higher samples with the denoiser, so noise sits at or under the reference's 2.0.
- **Focus:** 85 mm / f/1.8-style depth of field in mediums and close-ups; backgrounds turned into lights (string lights, monitor glow, city windows) so the blur makes bokeh, not grey mush.
- **Faces:**
  - key from the screen at 45°;
  - a cool rim from behind (window or string-light side);
  - a negative fill on the far side;
  - hair rim light.
- **Character fixes before any motion:**
  - neck and shoulder proportion (thicker neck, closer shoulders, collar seated);
  - wrists covered by the cuffs;
  - hair silhouette with flyaways.

## Round 4: why the three.js port looked cheap, and what changed

**Method:**
- **Parity sheet:** the same camera (`?cam=` in `viewer/index.html`) is rendered in Cycles and in three.js and placed side by side.
- **Measurement:** `tools/look_metrics.py` measures any frame the same way it measures the 68 night shots of the reference. Its definitions are slightly different from round 3's, so compare rows within this table only.

| Measure (night median) | Reference | three.js before | Cause | Fix |
|---|---|---|---|---|
| Fine noise in flat areas | **0.12** | 0.74–0.85 | grain 0.012 added every frame | grain 0.0035 |
| Saturation of lit pixels | **0.40** | 0.18–0.28 | AgX desaturates; grade sat 1.18 | sat 1.4; warmer highlights |
| Shadow colour | warm (+0.07) | blue (−0.04) | "cool shadows" grade term | only a hint of blue left |
| Highlight area | **0.6%** | 4.3% | Ivan's albedo lit by live lights, then bloomed into a veil | Ivan's light baked in Cycles (below) |
| Sharp share of frame | **0.6%** | 2.5–3.2% | BokehPass is weak and blotchy | physical thin-lens DOF pass (focal length, f-stop, focus distance) × 1.8 look factor |

**What made it read as "models placed in a scene":**
1. **Unbaked lighting.** In three.js every surface was lit only by a few analytic lights, with no bounce, no contact shadows and no soft falloff. *Now:* Cycles bakes direct and indirect light onto every static surface (ARCH / DESK / ROOM atlases), so three.js shows what Blender computed.
2. **Ivan lit live.** He was a flat albedo under a strong area light, which reads as plastic. *Now:* his diffuse light, including skin subsurface, knit and contact shadows, is baked in Cycles in the seated pose (he only types, breathes and glances). three.js adds only the moving specular.
3. **One roughness for everything baked.** *Now:* a roughness map is baked into each atlas, so the walnut and floor catch the screen while plaster stays matte.
4. **Curves skipped by the bake.** Cables, wires and the lamp arm were exported unbaked and glowed white. *Now:* they are converted to meshes before the bake.
5. **Lens streaks the width of the frame.** They read as scan lines. *Now:* shorter and fainter.
6. **Frames carried page margins.** *Now:* the render-mode stage fills the frame.

## Round 5: the engine, reference frames, the new Ivan

**References:** the OpenKnight film; the night precinct frame (a cool key, deep blacks, foreground silhouettes); and the kid at the CRT (a saturated blue screen key on the face, warm tungsten behind, a warm background, haze).

**Lighting setup** (`engine/src/lights.js`):

| Light | Role | Notes |
|---|---|---|
| Cycles lightmaps | everything static: city, sodium, string lights, bathroom spill, bounce | baked as irradiance; three.js adds textures and reflections |
| Desk lamp (spot, shadows) | the warm pool on the desk; hands and keys shadow | live; flickers ±1% (it hums) |
| Laptop key (area) | soft cool fill from the screen | live; 0.45 × Blender |
| Face key (blue spot, shadows) | the reference's saturated blue on his face | range 1.05 m, so it dies before the wall (no blue disks on the background) |
| Warm backlight (spot) | the bathroom light behind his right shoulder rims hair, ear and shoulders | the warm half of the warm/cool split |
| Wall wash (warm spot, shadows) | a warm pool grazing the wall behind him, falling off to dark; shelf shadows add depth | the reference's warm background |
| Monitor kicker (area) | dashboard light on his right cheek | small |

**Separation:** the shelf behind him became dark stained wood (it was white and merged with his off-white sweater). The walls are a warm limewash a stop under white.

**Life:**
- Ivan: typing in bursts; breathing; a slow body sway; reading saccades; shoulders riding the typing; lean-in, glance and nod beats.
- Room: string-light shimmer, monitor flicker, LED blinks, lamp hum.
- Camera: a slow drift of a few millimetres plus sub-degree operator breathing.

**Character:** Tripo multiview → Smart Mesh (quad, 27.5k faces, a single piece), PBR on, Mixamo rig. Glasses are modelled in Blender, fitted from the face profile (nose tip → bridge = eye line).
