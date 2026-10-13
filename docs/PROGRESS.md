# Progress log

## Round 2: look development, story detail, Ivan v1

**Pipeline (all headless, all code):**
- `blender/lib/materials.py`: procedural PBR materials (oak plank floor, plaster, walnut, brushed aluminium,
  knit, wool, quartz, glass, water, coffee). No downloads; bakeable to textures for three.js later.
- `blender/lib/props_desk.py`: the hero desk zone. Walnut desk on a steel frame; a laptop with real keys,
  a hinge and a live code screen; the full glass of water with clinging bubbles; three mugs (one cold
  half-full, two drained with residue rings); coffee-ring stains; the phone with her messages trailing off;
  the notebook with Ivan's system sketch; the cold lunch with chopsticks; the architect lamp (off); the mesh
  task chair; the wall clock at 3:04 behind his head; the charger cable to the wall; the router and power
  strip LEDs.
- `blender/lib/props_story.py`: the book drawer (Superintelligence, Deep Work bookmarked early on the bean
  bag), the battery radio, the framed photo of them, the wall print, the rug, mail and a dying plant on the
  dining table, the coffee maker with an inch left, mugs in the sink, the fridge menu, the bin with drafts
  and cans, sheer curtains, shoes by the door.
- `blender/lib/exterior.py`: the city 21 m below and around. Lit window grids (fewer as the night goes on),
  the parking lot with cars, sodium poles, rooftop beacons, the skyline ring.
- `blender/lib/lighting.py`: motivated presets `3am` / `4am` / `sunrise` plus the film look in the
  compositor (bloom, horizontal anamorphic streaks, lens dispersion, vignette, AgX Punchy).
- `blender/scenes/set_intro.py`: assembles everything and renders the 2:1 story shots `establish`, `face`,
  `ots`, `glass`, `desk34` and `wide`.
- `blender/characters/ivan.py` + `ivan_wardrobe.py`: Ivan on MPFB2.
  - Body and face shaped to the sheet.
  - Mixamo-compatible rig; eyes with a brown iris.
  - Skin with subsurface scattering.
  - Wardrobe built off his body: knit crew-neck sweater, shirt collar, wool trousers, shoes, round
    acetate glasses, strand hair with a side part, brows.
- `tools/make_textures.py`: every printed or screen image (laptop desktop, phone lock screen, clock face,
  notebook, book spines, photo, stickies, print).

**Story decisions made here (change freely):**
- His girlfriend is "Sasha" on the phone (placeholder; the script never names her).
- He left the bathroom light on: a warm rim behind him at 3 AM.

**Known issues / next:**
- Ivan:
  - skin tone and texture detail (pores read too smooth);
  - the hair tuft on the short side of the part;
  - shoes are placeholder blocks;
  - the sweater neckline edge;
  - not yet seated or posed in the set.
- Seated typing pose and placing him in the chair; then the face shot (`face`) becomes the hero frame.
- three.js: bake materials and lighting to textures/lightmaps and port the look to `app/`.
