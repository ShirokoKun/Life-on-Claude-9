# The director's visual taste: the baseline

Read this before designing any new frame. The images are in `reference/taste/`.
The director's words: *"the material in the room, the material on everything should be design-wise properly aesthetic
and properly positioned with intention."* Quality bar: AAA game or animated-feature frame, never "a basic simple scene".

## Reference 1: `ps1_subway_target.jpg`, the PS1 look (a style to *make*)

A night subway car rendered like a modern PS1-era game: low-poly, pixel textures, dithered colour, lit softly.

| Trait | What it is | Rule for us |
|---|---|---|
| Geometry | Low poly, clean silhouettes, smooth-shaded (Gouraud), few hundred polys per character | Model in large planes; the silhouette must read. Characters are segmented low-poly with smooth normals. |
| Textures | Low resolution (about 64–128 px per object), nearest-filtered, hand-painted: grime, graffiti, ad posters, route map, speckled floor | Paint every texture on purpose. Nearest filter, no mipmap blur. Detail lives in the texture, not the mesh. |
| Colour | Muted khaki and grey-green walls, rust-red vinyl seats, near-black windows; one strong accent (the red-and-black jacket) on the hero | Muted world, one saturated accent on the subject. |
| Light | Warm-white fluorescent tubes on the ceiling; soft falloff; no hard shadows; the face is lit from above | Few soft lights; shadows painted into textures (PS1 artists baked them in). |
| Pixels | Visible pixel grid, ordered dither in the gradients, 15-bit colour banding | Render at a low internal resolution, upscale with nearest, Bayer dither + 5-bit quantize. |
| Composition | Camera at seated eye height, angled down the car; the car recedes to a vanishing point at the left; subject right of centre; a dark window behind the head (negative space); a cropped passenger in the foreground for depth | Eye-level, one-point-ish recession, subject against a dark shape, a foreground layer. |
| Life | Smoke curling up in chunky pixels; the subject's idle pose has attitude | Each scene gets one small living detail. |

*Ignore* the overlays (the year, memory-card icons). The director said so.

## Reference 2: `kitchen_three_lightings.jpg`, one set in three moods (taste only)

One cluttered rustic kitchen (patterned tile floor, azulejo backsplash, wood table and chairs, open shelves, copper pots,
an enamel stove) lit three ways:
1. **Golden hour:** sun through the window, a hot slab of light on the table, warm bounce everywhere.
2. **Night, practical:** a ceiling pendant cone and a moonlit window; warm-brown overall.
3. **Moonlight:** almost black, one cold blue shaft through the window, haze, silhouettes.

Lessons:
- **The set is designed once; the light writes the mood.** Geometry and materials stay; only light and air change.
- **Light needs a visible source and visible air** (shafts, haze).
- **Props with intention:** everything sits where a person put it (a teapot on the table, plates on the rack, pans hung by size).
- Patterns (tiles, backsplash) give surfaces texture at a distance.

## Reference 3: `fog_night_red_blue.jpg`, the cinematic mood (taste only)

Dense blue night fog; a kiosk glowing hot red-orange; street lamps as cold dots; wet asphalt with long reflections;
a black car with a red interior glow; foliage silhouettes in the foreground.

Lessons:
- **Complementary palette:** deep blue fog against red-orange emissives. The warm light is small and the cold field is large.
- **Wet surfaces** double every light (long vertical reflections).
- **Fog is the depth system:** objects step back in values; silhouettes stack.
- **Foreground framing:** leaves, branches and wires cut the frame edges.
- **Glow, not detail, carries the far distance.**

## Reference 4: the tutorial video (method; see `docs/TUTORIAL_AI_ROOM_BUILD.md`)

Realism comes from density with order, wear, motivated light, atmosphere and an operated camera.

## The combined bar (what "good" means to this director)

1. **Intention:** every object is placed for the frame. No default props scattered for filler.
2. **Material truth:** roughness varies (wet vs dry, worn vs new), grime collects in corners, edges wear.
3. **Light with a source + air to show it:** shafts, fog, haze, bloom on sources.
4. **Palette discipline:** a dominant cool or muted field, one hot accent.
5. **Depth layers:** foreground cut-off, subject, receding background into fog or dark.
6. **One living detail per shot:** smoke, rain ripples, flicker, drifting dust, passing lights.
7. **Never "basic":** a scene must be interesting to look at as a still before it moves.

## Rejection, 2026-11-07: the first studies (read before building anything)

The director rejected "The Cistern" (and the WebGL-only approach): *"even nowhere near close to the quality of the tutorial…
your scene does not look 3D… not properly readable, lighting unnecessarily too much, no textures, the background and the
sides are not readable, I don't understand what is what, the ground looks weird, shiny, reflective… nothing is intentionally done."*

What went wrong, and the rules from the Life on Claude Nine book that already said so:
| Failure | Book rule |
|---|---|
| Built from procedural boxes and primitives | **A15**: open-licence assets before procedural builds (Poly Haven, CC0/CC-BY, free Blender scenes). Procedural reads "basic PS2" |
| A WebGL rasteriser with no bounce light: flat, not 3D | The tutorial is **Blender + Cycles** path tracing: soft GI, contact shadows, real AO. Use the real tool for look-dev and stills |
| Glow, fog and bloom everywhere; the subject unreadable | **A12**: readable first, then cinematic. **B4**: one motivated key, pools and falloff. Every glow is paired with a real light |
| A mirror floor | **B13** / lighting rule 7: floors are matte by default; wet only where a story puts water (puddles), never a whole mirror |
| Textures invisible (fog and darkness ate them) | Exposure measured: p5 < 0.05, p95 > 0.8, mid-tones carry the material; read the frame at 100 % |
| Shapes that are not things ("what is what?") | **A5**: one world with a concept and details with intent ("a control room, not random boxes"). Every object must be nameable |

Order for the next attempt: concept in one line → candidate assets (Poly Haven models, HDRI, textures) → grey clay in
Blender at real scale → Cycles look test with materials (judge at 100 %) → light in layers → restrained atmosphere →
side by side with the tutorial's final frame (`reference/taste/tutorial_ai_room_sheet_06.jpg`) before showing.
