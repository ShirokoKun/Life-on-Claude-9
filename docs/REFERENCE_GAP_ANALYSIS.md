# Reference gap analysis (round 6)

Every reference given so far, the bar each one sets, and where the current engine frames stand against it.

**Method:**
- Measurements come from `tools/look_metrics.py`: the same numbers for references and for our frames.
- Visual sheets:
  - `deliver/storyboard_vs_ours.jpg` (each storyboard panel beside our matching shot);
  - `deliver/reference_vs_current.jpg` (CRT kid, precinct, OpenKnight vs ours);
  - `reference/look-target/` (OpenKnight sheets).

## 1. The references and the bar each one sets

| Reference | What it is | The bar it sets for the intro |
|---|---|---|
| **Storyboard 04** (`04-storyboard-grid-nightroom-blue-sketches.png`), panels 1–6 | The intro chapter, shot by shot | The colour script and the framing. Electric screen blue is the only light; everything else is black. See section 2 |
| Storyboard 05 (painterly) | Later chapters: morning, bed, the face close-up | Panel 4 (face from slightly above, cyan screen light, glasses catching it, black surround) matches the intro's face shot |
| **OpenKnight three.js film** (the original video) | Render style | Night medians: 40% true black; median luminance 0.007; saturation 0.40; noise 0.12; ~0.6% sharp; glow hugging sources; anamorphic streaks; 2:1 letterbox; one colour world per shot |
| **The CRT kid** (your frame) | Lighting behaviour | Saturated blue screen key on a 3/4-profile face; warm tungsten background; hard light shapes (blind stripes); haze; foreground bokeh. Saturation 0.36 |
| **The precinct** (your frame) | Night palette | A cool key from one side; deep blacks; foreground figures as silhouettes with rims; the cast shadow of a figure on the wall |
| **Material/model refs** (the Ramanujan-style frames, 6 shots) | Material and background richness | Saturation 0.53–0.75; warm shadows. Backgrounds full of *things with colour*: patterned wallpaper, framed paintings, books with coloured spines, a green banker's lamp, a teal rain window, curtains. Faces carved by a soft side key; very shallow focus |
| Birdcage still, lofi desk refs | Practicals and mess | Warm practicals against teal night; halation; an organised mess around where he works |
| Character sheet | Ivan | Thin, round glasses, side part, off-white crew-neck over a white collar, dark pleated trousers, brown shoes. Now met by the new Tripo model |
| "5 Ways to Create Better Environments" | Method | Composition and lighting first; simple shapes with good materials; simple camera moves |

## 2. Shot by shot: storyboard 04 vs our frames

| Shot | Storyboard panel | Ours now | Gap | Fix |
|---|---|---|---|---|
| **S1 The zone** | Centred and symmetric from behind. Ivan a small silhouette against a burst of blue screen glow that pools on the ceiling; the room is black | A 3/4 wide from the living room. Warm wall, string lights, lamp, city window all visible; Ivan lit warm-white | **Colour and readability.** The storyboard's single idea (a man inside a glow) is lost in a lit room | Darken the room 1–1.5 stops; make the laptop glow on the ceiling and wall behind the screen the brightest area; Ivan reads as a silhouette with a blue rim. Optionally re-angle from behind him |
| **S2 Still full** | The glass huge in the left foreground, lit blue, with bright white rim highlights; Ivan behind, soft and blue | The glass is a faint sliver; Ivan's warm-lit torso and the warm bokeh dominate | **Hero object invisible; warm instead of blue** | Larger in frame (camera closer and lower); rim highlights from the screen; water catching the blue; Ivan in blue key and darker |
| **S3 Lit by the work** | Frontal face, lit from below by the screen: hard cyan light, deep shadows under the brows and nose, black surround | Frontal face (matches), but flat pinkish-white, a grey-beige background, and no shadow shapes | **Light direction and colour.** The key must come from below and in front (laptop height) and be blue and hard; the background must go black | Face key moved down to the screen and made harder and stronger; fill removed; background in darkness except a faint warm bokeh |
| **S4 The sprawl** | The screen full frame, glowing, with hands at the bottom (terminal, Claude chat, scripts) | Over the shoulder, the laptop smaller in frame, the room around it | **No insert of the screen content** | Push in until the screen fills most of the frame, with hands silhouetted against it; the screen content must be readable |
| **S5 Because he could** | 3/4 from his right side: laptop light raking across his face and glasses, blue, room black | Frontal, symmetric, the monitor's back as a big black block on the left, the lamp at right, a warm room | **Angle and colour** | End the arc on his right three-quarters (the storyboard view), where the laptop light becomes a side light; less warm room |

## 3. Measurements (night frames)

| Measure | Storyboard 04 | OpenKnight | CRT kid | Material refs | **Ours now** |
|---|---|---|---|---|---|
| Highlight colour (+ warm / − blue) | **−0.13 to −0.71** | slightly warm | +0.04 | +0.06–0.21 | **+0.13 to +0.22** |
| Saturation of lit pixels | 0.31–0.63 | 0.40 | 0.36 | 0.53–0.75 | **0.12–0.33** |
| True black share | 6–52% | 40% | 0–12% | 0–31% | 0.4–54% |
| Fine noise (flat areas) | 0.06–0.40 | 0.12 | 0.16–0.18 | 0.11–0.37 | **0.50–0.64** |
| Sharp-detail share | – | 0.64 | 0.3–0.9 | 0.5–1.6 | **1.4–2.3** |
| Bright area (%) | 1–31 (screens) | 0.6 | 0.1–2.9 | 0.004–1.9 | 0.01–7.7 (the sweater) |

## 4. The main gaps, in order of impact

1. **The colour script is inverted.**
   - Storyboard 04 is a blue-and-black world where the screen is the light.
   - We built a warm room (lamp, string lights, warm walls, a tungsten rim) with blue only as a tint on his face.
   - The CRT kid and the material refs do use warm, but as the *background accent*, never as the main light on the subject.
   - **Target:** blue screen light is the key on Ivan and the brightest thing in most shots; warm is under ~15% of the frame (string-light bokeh, a small lamp pool, a sliver of bathroom light); the rest is black.
2. **Light shapes, not fill.**
   - Every reference has hard, readable light shapes: the screen pool on the ceiling, blind stripes, a figure's shadow on the wall, the lamp cone.
   - We have soft, even fill on mid-grey walls.
   - **Fix:**
     - less ambient and bounce (lightmap gain on walls under 1);
     - a harder face key with real shadows;
     - Ivan's screen-cast shadow on the wall behind him;
     - the laptop glow pooling on the ceiling (storyboard 1);
     - optionally, sodium light through the blinds as stripes.
3. **Saturation is half the reference's.**
   - **Fix:** a saturated key colour (cyan-blue `#2f7bff`-ish, as in the storyboard); grade saturation to ~1.25; fewer neutral greys (darker walls).
4. **Gritty and over-sharp.**
   - Noise is 4× the reference and detail 2–3× (it reads as CG).
   - **Fix:** grain to ~0.004; fewer and larger dust motes, only inside light; DOF ×1.3; soft halation around sources.
5. **Hero object and insert shots.**
   - The glass (S2) and the screen (S4) are the storyboard's subjects, and both are under-shown.
   - **Fix:** reframe them as the storyboard draws them.
6. **Angles that give form.**
   - S5 should end on his 3/4 right, where the screen light rakes across his face.
   - S3 stays frontal (the storyboard is frontal) but is lit from below and in front, with shadows.
7. **Background richness** (the material refs).
   - Their backgrounds are full of coloured, textured objects. Ours are big plain plaster planes.
   - In a blue-and-black world, most of this falls into darkness anyway. Where background shows (S2, S3), it should be **bokeh shapes with colour**: book spines, the cork board, the string lights, the clock. Not grey wall.
8. **The white sweater is the brightest surface.**
   - Under a blue key it should go blue, with its shadow side falling off. **Fix:** less fill on Ivan, so the key does the work.

## 5. Scorecard (0–5, against the bar)

| Area | Score | Note |
|---|---|---|
| Character model and likeness | 4 | New Tripo Ivan matches the sheet; glasses fitted; face stays intact |
| Materials (PBR, textures) | 4 | Real textures and finishes; could use more coloured objects in view |
| Lighting physics (baked + live, shadows) | 4 | Mixed lighting works and is calibrated to Cycles |
| **Lighting design vs storyboard** | **2** | Warm room instead of a blue screen-lit world; soft fill instead of shapes |
| **Colour and grade** | **2** | Half the saturation; highlights warm instead of blue |
| Lens (DOF, bokeh, halation) | 3 | Physical DOF and bokeh are good; too sharp overall; glow too timid around sources |
| Image cleanliness | 2 | Grain and dust read as noise |
| Composition vs storyboard | 3 | S3 matches; S1, S2, S4 and S5 drift from the panels |
| Motion (character, camera, room) | 4 | Typing, breathing, saccades, sway, drift, shimmer |

## 6. The decision this asks for

The storyboard (blue-only) and the "comfy, cozy" brief plus the CRT and material refs (warm accents) pull in different directions. My recommendation:
- **storyboard first** (blue is the light; black is the space);
- **cozy comes from small warm accents** (string-light bokeh, the lamp's small pool on the desk, the bathroom sliver), not from lighting the whole room warm.

That matches the CRT frame's balance and keeps the storyboard's identity.
