# Room + character workflow: task breakdown

Owner: **C** = Claude (in this repo) · **U** = you · **C+U** = I build, you review/approve.
Every phase ends in a **gate**: a side-by-side against `reference/look-target/`. We don't move on until it passes.

How I build: the room is **code**. Blender runs headless here (`bpy`), so every wall, prop and
material is a Python script that exports glTF. Any dimension can be changed and rebuilt in seconds,
and everything is versioned in git. The renderer is a three.js app that loads the glTF.

Detail tiers (so effort goes where the camera goes):
**T1** desk zone (close-ups) · **T2** living/kitchen (wides) · **T3** bedroom/toilets (seen through doors) · **T4** exterior.

---

## Phase 0: World & spec (docs only)
- 0.1 Mine the script for room details → `WORLD_BIBLE.md` ✅ C
- 0.2 Confirm the world answers (city, floor, east-facing window, intro wardrobe) · U
- 0.3 Measured floor plan: turn the sketch into metric dimensions, wall thickness, door/window sizes, ceiling height · C, approved by U
- 0.4 Prop list with tiers and states (from the bible) · C
- 0.5 Look spec: numbers pulled from the reference stills (black level, bloom threshold, streak length, grain size, letterbox ratio, focal lengths) · C

## Phase 1: Engine + look-dev gate (the most important phase)
- 1.1 Vite + React Three Fiber app, glTF loader, scene state switcher · C
- 1.2 Post stack: AgX tonemap → bloom → anamorphic streak pass → DOF → chromatic aberration → grain → vignette → letterbox · C
- 1.3 Offline renderer: fixed timestep → headless Chromium → PNG sequence → ffmpeg · C
- 1.4 Control panel (leva): exposure, every light, every post effect, time-of-day · C
- 1.5 Grey-box desk corner + mannequin + glowing laptop plane · C
- 1.6 **GATE A:** the 3 AM grey-box frame graded to sit next to the reference stills · C+U

## Phase 2: Architecture (the shell)
- 2.1 Walls, floor, ceiling from the measured plan; real openings for doors and windows · C
- 2.2 Window and balcony-door frames, glass panes (one mesh per pane, for The End), railing · C
- 2.3 Trim layer: skirting, door casings, switch plates, outlets, ceiling light fixture, smoke detector, AC vent/radiator · C
- 2.4 Camera scouting: place storyboard 04 camera angles in the grey-box and check they fit the room · C+U
- 2.5 **GATE B:** walkthrough render of the empty shell, signed off on proportions · U

## Phase 3: Furniture & props (by tier)
- 3.1 T1 hero set: desk, chair, laptop, glass of water, mugs, phone, notebook, desk lamp, wall clock, cables · C
- 3.2 T2: bean bag, floor lamp, book drawer + books (incl. the planted titles), radio, photo frame, thermostat, dining set, kitchen run (coffee maker, sink, fridge, upper cabinets) · C
- 3.3 T3: bed (made, unslept), bedside lamp + drawer, toilet/shower/tub, shoe rack, doors · C
- 3.4 Sources: model hero props ourselves; pull CC0 models (Poly Haven etc.) for generic T2/T3 items, restyled to match · C
- 3.5 Bevels on every hard edge (the biggest "not CG" tell), real-world scale check · C
- 3.6 **GATE C:** furnished grey-material room, composition check from the storyboard angles · U

## Phase 4: Materials & textures
- 4.1 Material library: painted plaster, oak/laminate, fabric (bean bag, chair mesh, sweater), ceramic, glass, water, brushed aluminium, plastic, rubber, paper, screen glass · C
- 4.2 PBR textures from CC0 libraries (ambientCG, Poly Haven), 2K for T1 and 1K below, KTX2-compressed · C
- 4.3 **Storytelling grime layer:** coffee rings, dust on the shelf, fingerprints on the laptop lid, wear on the chair armrest, a scuffed floor path between desk and kitchen · C
- 4.4 Water-glass hero shader: refraction, the meniscus, clinging bubbles · C
- 4.5 Screen content: live canvas textures for the terminal, Claude chat, Python editor, phone lock screen, clock face. Animated: typing, scrolling, cursor blink · C
- 4.6 **GATE D:** material close-ups under neutral light · U

## Phase 5: Lighting & atmosphere
- 5.1 Practical inventory placed: laptop area light, phone, LEDs, city spill, sky, sun · C
- 5.2 Presets: `intro_3am`, `intro_4am`, `intro_sunrise` (+ an empty slot for later states) · C
- 5.3 Baked ambient occlusion and contact shadows; real-time shadows for moving lights · C
- 5.4 Atmosphere: dust motes in the sunrise beam, faint haze for volumetric shafts · C
- 5.5 Exterior: city backdrop with interior-mapped windows, parking lot, streetlights, sky per preset · C
- 5.6 **GATE E:** the 3 presets from the same 3 camera angles = 9 frames, graded against the reference · C+U

## Phase 6: Character (Ivan)
- 6.1 Design lock: base look from the sheet + the intro variant (bible §5); turnaround approval · U
- 6.2 Build path, choose one:
  - **(a) Character Creator 4 + Headshot from the sheet** · U builds, C specs. Best match to the reference look, with a face rig. ← recommended
  - (b) I build a stand-in mannequin with correct proportions so all shots can be blocked while (a) happens · C
- 6.3 Rig check: body skeleton, ARKit-52 face blendshapes, eye and jaw bones · C+U
- 6.4 Look details: card hair (messy variant), stubble, bloodshot eye texture, under-eye darkness, glasses with smudge + reflection, sweater fabric · C+U
- 6.5 Import into the room; check skin under all 3 presets (blue screen light is unforgiving on skin) · C
- 6.6 Motion library for the intro: hunched typing loop, reaching for the mouse, rubbing eyes, the 4 AM tremor, looking at the untouched glass, the lean-back at sunrise · C+U (mocap libraries + your phone capture)
- 6.7 **GATE F:** Ivan close-up at 3 AM next to the reference close-ups (`t000013.5`, `t000030.5`) · U

## Phase 7: Alive pass (what makes the room breathe)
- 7.1 Clock second hand, cursor blink, terminal output scrolling, a laptop fan-noise cue
- 7.2 Phone notification glow; fridge compressor hum + its LED
- 7.3 Dust motes drifting; a faint curtain sway from the AC
- 7.4 Exterior life: a distant car crossing the lot, windows switching off over the night, the sky drifting
- 7.5 Handheld camera noise + focus breathing as reusable camera behaviours
- 7.6 **GATE G:** a 20 s test sequence (3 AM → 4 AM → sunrise) rendered through the offline pipeline · U

---

## Order we run it
0.2–0.5 → **Phase 1 (gate A)** → 2 → 3 → 4 → 5 → 7, with Phase 6 running in parallel from the start (you on CC4, me on the mannequin + rig pipeline).
