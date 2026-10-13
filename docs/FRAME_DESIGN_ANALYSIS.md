# Frame design: references vs our frames (round 7)

This compares composition, light structure and frame design against the references only: the OpenKnight film, the CRT kid, the precinct, and the six material/character frames. The storyboard is used only for which beats exist.

Measured with `tools/frame_design.py` (same numbers for references and ours):
- **contrast:** the spread of brightness, in stops (flat about 1.5, dramatic 2.5+);
- **mid%:** the share of dull mid-grey;
- **key/fill:** stops from the brightest 5% of the subject zone to its median;
- **subj/bg:** separation of the subject from the frame edges, in stops;
- **dark%:** negative space.

## 1. What the references do

| Reference | Camera | Subject placement | Layers | Light | Measured |
|---|---|---|---|---|---|
| **CRT kid** | Seated eye height, 3/4 from behind-left, ~35 mm | Right of centre, looking *into* the frame (toward the CRT) | Foreground: a big dark CRT plus blue out-of-focus flare. Midground: the boy. Background: warm window and blinds, bed, poster | One cool key (the CRT) on the profile; warm sun from behind as rim and background; hard stripes on the bed | contrast 1.9, key/fill 3.3, subj/bg +2.1 |
| **Precinct** | Standing height, wide | Officer on the left third; two figures' backs fill the right half as dark masses | Foreground silhouettes, midground subject, wall with his shadow | A cool key from the left; figures' cast shadows on the wall; the rest falls to black | dark 84%, contrast 1.2 (low-key) |
| **OpenKnight (74 shots)** | Low angles, wide anamorphic, slow push and track | Small subjects in big dark frames; light sources inside the frame | Constant foreground occlusion (pillars, car parts, figures) | Light lives in the sources (headlights, lamps); bloom halos around them; one colour world per shot | contrast 3.2, mid% 27, key/fill 3.7, dark 48% |
| **Material refs** (night desk) | Medium-wide, slightly above the desk | Writer at the right third; the green banker's lamp at the right edge as a frame-in-frame | Foreground desk, midground man, background bookshelf with coloured spines and a teal rain window | Warm lamp pool on the desk and face (side), a cool window on the left; strong warm/cool colour blocking | dark 51–72%, key/fill 4.1–5.7 |
| **Material refs** (close-ups) | Eye level or slightly below, 50–85 mm | Face centred, tight headroom | Background: patterned wallpaper and a framed painting as soft bokeh *with colour and shape* | A soft warm side key; the face's far side in shade; eyes catch light through the glasses | key/fill 2.6–2.7, mid% 57–75 (warm, not grey) |

**Shared rules:**
1. **One dominant key per subject, from the side.** The far side of the face falls into shade (key/fill 2.5–5.7 stops).
2. **Light sources in the frame** (lamp, CRT, window, headlights), each with a soft halo.
3. **Three layers:** a dark or soft foreground object, a sharp subject, and a background with shape and colour.
4. **Negative space is dark, not grey.** Mid-grey walls are rare; walls are either lit (and coloured) or black.
5. **Look room.** The subject faces into the frame.
6. **Shadows tell the story:** a figure's shadow on the wall, blind stripes, the lamp cone.

## 2. Our frames against those rules

| Shot | Before (round 6) | Now (round 7) | Verdict | Still to do |
|---|---|---|---|---|
| S1 high corner | contrast 3.8, dark 77%, subj/bg 6.8 | same | Matches OpenKnight's "small subject in a big dark frame"; the screen glow and city window are in frame | A bright box on the shelf in the top-left foreground pulls the eye. Darken it or reframe |
| S2 glass → Ivan | key/fill 0.3, mid% 36 | key/fill 0.5, mid% 21 | Layering matches the CRT frame (glass foreground, Ivan midground, string-light bokeh background) | **His white sweater is the hottest thing in frame**; the subject zone is flat. Bring the sweater albedo and lamp spill down |
| S3 face | contrast 1.4, **mid% 60, dark 3%** | contrast 2.0, mid% 26, **dark 44%** | Now side-keyed by the monitor, with **his own shadow on the wall** (the precinct). Big step | The background is a plain wall; a little warm bokeh (string lights) would add the material refs' "background with colour" |
| S4 screen insert | contrast 4.6 | same | Screen readable, hands present, halo around the screen | Fine |
| S5 profile | contrast 3.4, key/fill 8 | contrast 3.7, key/fill 9.8, dark 73% | Dramatic: the profile is cut out of black and his shadow is on the wall | **No look room:** he sits at the right and faces the right edge. Shift the frame so he looks into space |

## 3. Why Ivan read desaturated and overexposed (and what changed)

**Cause:**
- Six light sources reached him at once: the screen area light, the blue key, the monitor, the lamp, the warm rim, and the room's reflected light.
- Every side was lit, so there were no shadows.
- His pale skin and off-white sweater sat near clipping, and the tone curve drains colour from near-white.

**Round 7:**
- One dominant cool key from the side (the dashboard monitor, with shadows).
- The laptop cut to a low front fill (−50%).
- Room reflections on him cut by 3× (key-to-fill about 8:1, as in the references).
- The lamp narrowed to a pool on the keys.
- Sheen reduced.
- Walls carry less bounce, so the light pools read as shapes.

**Next:**
- The sweater's albedo comes down about 15% (still off-white), so it stops clipping.
- S5 gets look room.
- S1 loses the bright box.
- S3 gets a hint of warm bokeh behind him.

## 4. Render speed (for the final pass)

| Step | Cost per 1080p frame |
|---|---|
| Before: GPU work | 11.3 s (depth of field 6.5 s) |
| After: half-resolution depth of field + static shadows for the wall wash and blinds | **7.1 s** |
| Saving the frame | 0.7 s |

Parallel workers: see the measurement in the render log. On this 4-core machine with no GPU, each software-GL worker already uses several threads, so 2 workers is the expected sweet spot. On a machine with a real GPU, `npm run render` is real-time.
