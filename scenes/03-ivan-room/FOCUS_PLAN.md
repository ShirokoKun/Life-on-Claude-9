# Focus pass: Ivan first, the room supports him

References: `ref/mood/focus/bed_window.jpg` (Ivan on the bed), `ref/mood/focus/subject_light_set.webp` (cinematic character stills).

## What the references do
1. **One motivated key on the subject.** Window light (bed frame) or a single practical; the face and hands are the brightest skin in frame.
2. **Separation:** a rim or edge light on hair and shoulders from behind/side; the subject reads against a darker background.
3. **The background is a stop or two under the subject,** still readable, warm-neutral, falling off to the frame edges (no even fill).
4. **Practicals are dim:** a lamp is a soft glow in the set, not the brightest object (bed frame: the lamp is barely on).
5. **Warm-white, low saturation.** No blue cast; blacks soft, not crushed.
6. **Simple, grounded set:** a mattress-like bed on a low platform with no legs; one clear desk setup.

## What we do wrong now
- Everything is lit the same: room, desk and Ivan at about the same brightness, so nothing leads the eye.
- The desk lamp is the brightest thing in frame and pulls attention off Ivan.
- No rim on Ivan; his dark tee merges with the dark chair and wall.
- Two monitors read as clutter; the desk has no clear "hero" setup.
- The bed stands on legs; the refs and the script want a low bed.

## Fixes (in order)
| # | Fix | How | Bake? |
|---|---|---|---|
| 1 | Subject over background | `focus` look: room lightmaps down ~1.3 stops, warm-white ambient, vignette falloff | live |
| 2 | Rim on Ivan | a soft warm-white back light from the window side, aimed at his head and shoulders | live |
| 3 | Lamps quiet | the shades and bulbs far dimmer; the arm lamp a soft glow, not a hotspot | live (+ bake) |
| 4 | Warm-white grade | split tone toward neutral warm, low saturation, no teal | live |
| 5 | One monitor | remove the second monitor; laptop + one monitor, mugs and cans, notebook | bake |
| 6 | Low bed | no legs; the frame sits on the floor | bake |
