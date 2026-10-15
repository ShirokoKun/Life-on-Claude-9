# Keyframe audit, board r7b (2026-10-15)

This is a frame-by-frame review of `renders/kf1/r7b/` against each shot's `why`, `board` and `tr` fields and the storyboard. It was done by a review agent plus the director's notes from the same day. It is the defect list for the **lock pass**: tick items as they are fixed and checked in a render.

Already in rework when the audit ran (so not audited):
- K13 (drowning, rebuilt);
- K29 (eye, rebuilt);
- K11/K12;
- K24 sky and ground;
- K45 (building, rebuilt);
- K46 bars;
- the mug grips.

## Director's notes (2026-10-15)

- [ ] **Postures, hands and rig** must look natural and human, after references:
  - [x] sip posture (elbow down and forward, neutral wrist, handle grip);
  - [ ] the other poses.
- [x] **K02:** the head and eyes look off. Now a 3/4 profile eye through the rim, head lifted, focus on the iris.
- [x] **K04:** the water shows but the glass is blurred away. Root cause: the glass was a 7% film that wrote no depth, so the lens blurred it like the wall behind; the water was frosted (roughness 0.7). Fixed with clear water, a Fresnel glass shell that writes depth, a rim, a base and a meniscus (`refineGlass`, kf1 only).
- [x] **K07:** make it better or change it. Now board r1c5: the screen fills the frame, with code, chat and green light.
- [x] **K10:** improve it. Now board r1c6: his face in the screen light, Claude a warm figure over his shoulder.
- [x] **K11:** the top shot with letters floating around him is overwhelming. Made clean.
- [x] **K12:** looks random; follow board r1c7 (reclined, phone up, one big chat card, warm haze). Leans back, phone up, the readable chat card; no envelopes.
- [x] **K24 cheat code:**
  - [ ] a black ground with white grid lines;
  - [ ] a black-to-very-dark-violet gradient;
  - [ ] a void sky, dark violet and blue;
  - [ ] the magical small elements kept, with a character of its own.
- [ ] **Imagined frames** need their own texture and flair, separate from the normal scenes, without looking cheap.
  - The imagination pass is done (grain, posterise, duotone).
  - [ ] Tune it per world.
- [x] **K29:** after the director's eye reference (rust print grain, coloured streaks in the lower lenses, low 3/4).
- [x] **K13:** after the director's drowning reference (chair in a void, pages at every depth).
- [ ] **Transitions** from the normal scenes into the imagined ones, step by step: how Claude appears and how the elements appear. See `TRANSITIONS.md`.

## Audit findings (High first)

✓ = fixed in r8, ~ = improved, needs a posture pass.

| Frame | Sev | Defect | Fix |
|---|---|---|---|
| K44 ✓ | High | Far lens sits off the face, glasses look broken; whole face soft; warm peach instead of the board's cyan flare in wonder. | Turn the head toward camera (both lenses seated), focus the near eye, cyan front key up, amber to a rim, a wonder pose time. |
| K02 ✓ | High | Board wants an eye in profile with screen light; frame is a frontal, soft, near-closed pair of eyes; eyelid geometry shows through the lenses as shards. | Profile or 3/4 at the eye, longer lens, cool screen key with a glint, focus the iris, fix lid poke-through. |
| K42 ✓ | High | Ivan a tiny head cut by the bottom bar; cubes cover Claude's face; a huge pale cube slabs across the top right; the warm stream is only specks. | Reframe (Ivan and desk at about 1/6 frame), clear the cubes in front of Claude, cold rim, push back the foreground cube, stacked modules, a visible warm beam. |
| K07 ✓ | High | Nothing sharp (focus pick misses); terminal, chat and scripts unreadable; the hair blob reads as nothing. | Focus the screen plane, legible screen zones, a clean shoulder wedge. |
| K27 ✓ | High | Back of his head only, face hidden; crowd "far off in the dark" not visible. | Camera about 40° to his side or head turned; a faint backlit crowd row. |
| K40 ~ | High | The mug that "won't keep still" is out of frame; typing hand a fist; blown orange hotspot at the hinge; big blurred head. | Reframe to include the mug hand, an open hand, amber −1.5 stops, smaller head. |
| K49 | Med | Claude a tiny grey sprite above the monitor, not sitting on it; lamp overlaps the calendar icon; modules too bright for "idle". | Claude on the bezel at 1.5–2× scale, move the icon, modules at about 40%. |
| K39 | Med | Soft and half-lidded, warm flat front light; board wants a cold under-light from the screens. | Lower the camera, a cold key from below, focus the near eye. |
| K41 | Med | Reflections are washed white bands covering the eyes; don't read as code. | K29-style coloured syntax lines, lower k, keep the eye visible. |
| K25 | Med | Hard peach disc under his feet plus hatch and ring artefacts; bars thin and cyan-only; fists. | Soft contact glow, remove artefacts, warm bars at depth, relaxed hands. |
| K22 | Med | Ghost Ivans are muddy blobs overlapping him, plus a stray pink hand; don't read as three time-skips. | Clear offsets, one cool and one warm tint, remove the stray. |
| K08 | Med | Sticky notes cover the monitor header; label not visible. | Move or hide the notes for this shot. |
| K12 ✓ | Med | Board: sprawled back, phone up. Frame: upright in profile at the laptop, phone hidden by envelopes. | Reclined pose time, phone in view, no envelopes, one chat card. |
| K14 | Med | Claude should pop out of the phone; phone is a black slab at the edge and Claude floats over the shelf. | Claude just above the phone screen, its glow on the phone, his eyes on it. |
| K15 | Med | Claude (the salesman) tiny and hidden behind the bookcase; the lamp passes through the icons. | Claude in the open at screen left, larger; icons clear of the lamp. |
| K16 | Med | "In daylight" but reads as night (ev −2.2); hands dark. | ev about −1, warm window key. |
| K10 ✓ | Med | The y/n prompt and Claude's warm blur are not visible; fingers merge. | Include the screen with y/n, Claude a warm blur behind, focus the fingertip. |
| K43 | Med | Finger "coming down on Enter" is a fist; no Enter key. | Index extended, Enter visible, focus the fingertip. |
| K19 | Med | Board: hands spread on the keys, mouth a little open, an idea arriving. Frame: sleepy face looking down. | Head up 10°, include the hands. |
| K20 | Med | Eyes read closed; lids as dark slits on the lenses. | Same head lift as K19, focus the irises. |
| K50 | Med | Hand behind the head a banded fist; no window-bar light on the face; hairline at the edge. | Laced fingers, stronger cross gobo on the face. |
| K51/K52 | Med | Far lens rim broken or offset; K52 cuts the face at the nose; hands behind the head lost; no window-bar stripes. | Seat the glasses, pull K52 back, gobo bars. |
| K46 | Med | Dark tower column through his forearm; floats with no shadow; dotted patch under his feet. | Clear the column, contact shadow, remove the patch. |
| K48 | Med | "The room gold" but only window and desk are gold; chair colour off; head in hands reads as despair. | Warm bounce, match the chair, hands-on-keys pose time. |
| K24 | Low–Med | Monitor back a flat black slab over a quarter of the frame; arms cut. | Rim the monitor or crop; lower the camera 0.1 m. |
| K21a–d | Low–Med | Calendar icon intersects the lamp; clock cut by the bar; Claude a speck; props pop in. | Shift the icons, scale Claude, lock the prop set. |
| K47 | Low–Med | Glass reads milky and empty, khaki not gold. | Water line and rim highlight, gold key. |
| K32 | Low–Med | Focus ends on a soft screen; envelopes clipped; torso fills a third. | Focus the screen plane, reframe. |
| K31 | Low–Med | Phone screen dull, messages unreadable; ghost-hand blob at the edge. | Brighter screen, larger text, clear the hand. |
| K23 | Low | TODO text soft; no shoulder. | Focus the text, add a shoulder wedge. |
| K18 | Low | Icon row touches the frame edges. | Shrink 10%. |
| K05 | Low | Back crushed to black; upright not hunched; stray rod by the laptop. | Screen rim on the shoulders, forward-leaning pose time. |
| K09 | Low | Claude idle and soft, not visibly stacking. | Type pose with a brick, focus Claude. |
| K03/K04 | Low | Glass reads empty or brown. | Water line, meniscus, blue key (K03). |
| K36/K10/K16/K43 | Low | Four near-identical keyboard macros. | Vary angle, side and key between them. |
| K38 | Low | Lamp head floats detached in the void (also K21b–d). | Faint rim on the arm, or mask the head. |
| K30/K33–35 | Low | Jagged sleeve and mug-rim edges. | Soften. |
| K14/K50/K48 | Low | Thin black hairlines at the frame edge. | Find and hide the stray rod or sliver. |

## Cross-cutting causes (fix once, many frames improve)

1. **Eyes read closed in many frames** (K02, K19, K20, K39, K41, K51, K52). His eyes are fixed geometry with a lowered lid, and the held pose looks down. The fix is to lift the head (`look`) and lower the camera, so the eye reads open from below. The real fix is an eyes-up or open-lid variant of the head in Blender.
2. **Focus misses** (K07, K23, K32, K39): `lap:` and `mon:` focus picks and a 0.3–0.5 m depth of field. Board renders also kept the previous shot's focus for one frame; fixed 2026-10-15, as `kf_board` now renders every frame twice.
3. **Glasses seating** (K44, K51, K52): at some head yaws the far lens floats.
4. **The repeated keyboard macro** (K10, K16, K36, K43): vary them.
