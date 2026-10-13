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
