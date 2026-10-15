# Chapter 1: how the picture moves between the room and his imagination

Status: **draft for the director's review** (2026-10-15). Once the keyframes are locked, this is the brief for the animation pass. The keyframe ids, times and sound hits are from `engine/scenes/kf1/scene.js`, on the VO clock (201.64 s).

## 1. Grammar (applies to every crossing)

The film has two states: **the room** (real, baked light, the film LOOK) and **his imagination** (the zones). Every crossing between them follows five rules.

1. **One anchor survives the crossing.** Some real object stays on screen while the world around it changes: the chair (drowning), the desk and laptop (cheat, V13 modules), his glasses (the eye), the mug (balcony). The eye always has something to hold on to.
2. **Every crossing starts on a sound.** It lands on a hit in the mix (a rush, chime, sub drop or vacuum), never on an arbitrary frame. The hits are already marked in the shot list (90.59 rush, 51.01 chime, 64.11 sub drop, 105.15 vacuum, 166.00 "HE", 195.52 vacuum).
3. **The texture announces the state.** The imagination pass (stipple grain and soft posterise, `ZONE_IMAG`, the eye's rust duotone) ramps from 0 to the world's value across the crossing, and back down on the way out. Normal frames never carry it.
4. **In slow, out fast.** We enter the imagination by a build: the room dims, things rise, light spreads (0.6–1.2 s). We leave it with a snap, a hard cut on a hit, because reality returns abruptly. The only gentle exits are the dawn returns (K47).
5. **One camera move per shot** (the locked camera language). Held emotional frames get a 2–5% push-in. Worlds get a slow lateral drift or a rise. Depth of field changes only by keyed focus pulls. There is no motion blur except on the explicit rushes.

### The building blocks (one implementation each, reused everywhere)

| Mechanism | What happens | Driven by |
|---|---|---|
| **Dim to black** | The room's lightmaps fall to 0 around a lit desk island over 0.8 s, with an ease-in curve. | `dim` 1→0 over the shot's first `tin` seconds |
| **Fall away** | The walls, floor and shelves slide out of frame and fade on the rush (0.5 s, ease-out). Behind them the zone sky is already there, so the room peels off a world that was waiting. | new `tin: { kind: 'fall' }` |
| **Rise / build** | Things are born from a device. A pixel spark leaves the screen or phone, then the object assembles voxel by voxel (`build` 0→1, 0.4–0.6 s) with a small bloom flash and a soft light on the desk. | `cl.build`, icon `build`, new `born: [x,y,z]` |
| **Match cut** | The same composition across time or worlds (K01/K11/K48 top-downs; K04/K47 the glass). | Shared camera constants |
| **Vacuum cut** | Hard cut to black on the vacuum hit; the next world fades up from black on its own sound. | `black`, `tin: { kind: 'fromBlack' }` |
| **Snap back** | A hard cut to the room on a hit; the imagination texture drops to 0 on the cut frame. | Cut |

### How Claude appears (every time)

Claude is never just there.
1. A warm pixel spark lifts off the screen or phone that "called" it, with the device's own light colour.
2. Claude assembles **bottom-up, voxel by voxel**: `build` 0→1 over 0.5 s, each layer landing with a one-frame overbright.
3. Its glow light fades in **after** the body is complete, so the light on Ivan's face lags by about 0.2 s. That sells the light as coming from Claude.
4. On exit, Claude **disassembles top-down** into pixels that stream back into the device in 0.3 s.

The audit notes (K09, K14, K15, K49) also ask that Claude is **big enough to read** (≥1.5×) and **touching something** (on the phone, the monitor bezel, the desk) instead of floating mid-air.

### How the elements appear (modules, pages, icons, glyphs)

- **One by one, on the beat.** Each element arrives on its own word or beat (V13: 74.1, 75.9, 77.7, 79.6). No cloud of elements appears at once.
- **Each element arrives with its own light.** A soft point light of its colour turns on with it and catches the desk and his face; it's off before arrival.
- **Born near the anchor.** Elements come from the laptop or phone and travel to their place on a short arc (0.4 s, ease-out with a 3% overshoot). Nothing pops in mid-air.

## 2. The crossings, step by step

### A. Night to day flashback: K10 → K11 → K12 (34.9–46.4 s)
1. K10: the macro on the keys; the cut lands on the hit (36.25).
2. K11 cuts to the K01 top-down **match**. The light starts at 3 AM and drains into day over the first 1.2 s (blend the light weights 3am→day).
   - There is nothing else in the frame: the director cut the floating letters.
   - Camera: a 3% push down.
3. K12: "push down from the top-down into him". It's a cut to board r1c7:
   - he's reclined with the phone up, and **one** big chat card hangs beside him in warm pink haze;
   - the card types his line as he says it (the text reveals on the VO words).

### B. Into the drowning: K12 → K13 → K14 (46.4–55.3 s), imagination, chair as anchor
1. In late K12, on "every single one wants a reply", the first pages **leave the phone screen**: 3, then 10, then 40, each born at the phone on a short arc.
2. Cut to K13 (frontal, director ref 2) on "drowning". Over the first 0.8 s the room **dims to black** around the chair, and the remaining pages rise into place from below frame. Imagination texture 0→0.2.
3. Hold: the pages drift (slow rotation, ±2 cm float, the near ones crossing the lens soft). Camera: a 4% push-in toward his face. Focus stays on his eyes.
4. **Snap back** on Claude's chime (51.01): hard cut to K14, bright daylit desk, no pages. Reality.
5. K14: **Claude is born from the phone** (the rule above). Ivan's eyes are on it.

### C. The offer: K14 → K15 → K16 (50.8–63.8 s)
1. K15: the room **dims to 0.35** (not black: this is pitch, not trance). The four pipeline modules **build one by one** from the laptop, joined by pixel arrows drawn left to right on the words. Claude stands at screen left, ≥1.5×, presenting.
2. K16: cut down to the keys; "yes" is pressed.

### D. The V13 void: K20 → K21a → K21b/c/d → K22 → K23 (72.6–89.9 s), desk island as anchor
1. K21a: the room **dims to black** around the desk over 1 s. The desk, chair, laptop and monitor stay, lit by the screens (ref Group 9).
2. K21a–d: each module is **born from the monitor on its beat** (74.1 calendar, 75.9 meetings, 77.7 documents, 79.6 research). It travels up on its arc, lands with its own glow, and its light turns on. Earlier modules stay, dimmed to 60%. The props are locked across the four frames (audit).
3. K22: time-skip tick (82.07). Three ghost Ivans (typing, slumped, upright) flicker in at clear offsets, one tint each, then fade.
4. K23: **snap back** to the room, over his shoulder; texture → 0.

### E. The cheat code: K23 → K24 → K25 … K29 (85.2–105.35 s), the big flight
1. K24, on the rush (90.59), the walls **fall away**:
   - walls, shelves and floor slide outward and down (0.5 s), revealing the violet void that was waiting behind them;
   - the white grid **draws itself outward** from under the desk (a radial reveal, 0.8 s);
   - the stars twinkle on;
   - the code types in glyph by glyph (↑↑↓↓←→←→BA), each glyph popping with a sparkle on the beat;
   - Claude cheers; texture 0→0.35.
2. K25: **the desk drops away** (it slides down and fades in 0.6 s) and he is standing in the dark among soft warm and cyan bars (the audit wants warm bars at depth and no disc artefacts).
3. K26 → K27 → K28: continuous worlds, cuts only.
   - K26: from above to below.
   - K27: round to his profile (fix: the face must read).
   - K28: the rings **straighten into a tunnel** (animate the ring radius and spacing into a corridor).
4. K29, cut in to the eye: the rust print look (texture 1.0, duotone). The coloured streaks **slide across the lower lenses** (animate the lens map offset) as the light rushes past him. **Vacuum cut** to black at 105.15.

### F. The balcony: K29 → K30 … K35 (105.35–129.4 s), the mug as anchor
1. K30 **fades up from black** on the phone buzz (105.65). The city bokeh blooms in as the focus pulls from infinity onto him (0.8 s).
2. K31 and K32 are inside: straight cuts (reality). K32's focus pull goes from the phone to the laptop.
3. K34, "thinness": the city's round bokeh **stretches into horizontal lines** (anamorphic stretch, 1.5 s), with texture 0→0.2. It's the one imagined beat on the balcony.
4. K35: back to round bokeh; the camera drifts 3% round his shoulder.

### G. The tower: K41 → K42 → K43 (147.4–162.2 s)
1. K41: the eyes, with code reflected (K29-style coloured lines, the eye visible).
2. K42: the walls **fall away again, cold**. Blue blocks build up into a tower **from his desk upward**, layer by layer. Claude sits atop, lit by a cold rim. A warm beam rises from the desk. The audit reframe applies: Ivan and the desk at about 1/6 of frame, no cube over Claude's face.
3. K43: **snap back** to the macro on Enter.

### H. HE built that: K44 → K45 → K46 → K47 (162.2–175.2 s)
1. K44: the screen **flares cyan** on the pass chord (wonder). The glasses must be seated (audit).
2. K45: **hard cut on "HE" (166.00) to white**. The building is already there; the camera rises 5% (a slow tilt up the facade). Texture 0.3.
3. K46: cut on the drop (168.85) to above. He is small on the pale ground, with a soft contact shadow.
4. K47: the **vacuum** (171.94), then **dawn rises** (173.28) on the K04 glass frame: a gentle return, the only slow exit.

### I. The end: K48 → K53
1. K48 is the third top-down **match** (K01/K11): gold.
2. K49–K52 are cuts in toward his face (the same axis, tighter each time).
3. K53: **cut to black on the vacuum** (195.52); the hollow chime plays over black.


## 2b. Director's notes, round 9 (2026-10-16): how these play

### K12, Claude orbits (41.9–46.4 s)
- Claude is born from the phone screen at 42.2 s: a pixel spark, then it assembles bottom-up over 0.5 s.
- It orbits him once, slow and wide (radius about 0.45 m, 3 s, ease in and out, a little vertical bob). It passes behind his head first, so the orbit reads in depth.
- It settles between his face and the phone as he says "every single one wants a reply" (about 45.6 s).
- Ivan's eyes stay on the phone; only his head turns a few degrees after Claude.
- No chat card.

### K12 → K13, into the drowning
- On "drowning" (46.4 s) the cut lands on the same posture (phone up).
- The room's lightmaps fall to black over 0.8 s, keeping his chair.
- Pages rise into place from below frame in three waves (0.3 s apart). The about 1 in 12 that glow come last.
- The halo behind him fades up with the third wave.
- The drift is the hold:
  - each page slowly rotates, ±3° per second;
  - it floats ±2 cm on its own sine;
  - near pages cross the lens.
- Camera: a 4% push-in onto his eyes.

### K15 → K18 → K21, the dim that carries
- K15: on "I can write a script" the room's light falls to 16% over 1 s and stays there. The four modules build one by one on the words (inbox, sort, draft, you), each 0.4 s, born from the laptop.
- K16 (the keys) keeps the dimmed light: the room never comes back up.
- K18: dusk, the room still dim; the pipeline runs across the bottom of the frame.
- K21a: the last 20% of the room falls to black around the desk. The research void follows directly from the dim the offer started.

### K22, the time-skip (81.8–85.2 s): how it is shown
The frame stays still. Time is shown by what changes around him, in four ticks on the beat (82.07, then every 0.55 s):
1. **Tick 1:** the clock module's hand jumps a quarter turn. A first ghost Ivan (cool tint, slumped) appears at his left, 0.6 m away. The screen glow on his face flickers.
2. **Tick 2:** the clock jumps again. A second ghost (warm tint, upright) appears at his right. The first ghost fades to half.
3. **Tick 3:** the clock jumps again. The ghosts swap opacity. The modules overhead pulse once each, left to right, as "tasks completed".
4. **Tick 4:** both ghosts collapse inward into him (0.25 s, ease in) with a soft flash on his outline.

Rules: the ghosts never overlap him. Each tick is one frame-hard change (a time-lapse, not a dissolve). The real Ivan keeps typing at normal speed throughout.

### K24 → K25, the desk falls away (89.9–97.4 s)
1. **K24** holds wide on the cheat world:
   - the code types in glyph by glyph on the beat;
   - the six life power-ups spin and bob around him (COFFEE x99, +38H, 100%, 0 UNREAD, SKIP SLEEP, LVL UP);
   - each power-up is born from the laptop screen on its own beat and arcs out to its place.
2. From 92.6 s the camera starts to **rise and swing over him**: one continuous move, 1.2 s, ease in and out, ending on a top-down that tracks his head.
3. As the camera passes over his head (93.4 s), the desk, chair, laptop and monitor **break into pixels and fall away** below him (0.6 s, staggered from the edges inward). The power-ups shrink into points of light that join the stars.
4. His pose changes from sitting to standing while the camera is overhead. From above, the change reads only as him rising, which hides the switch.
5. **K25** begins on that top-down. He stands in the dark, and the soft bars fade in at every depth.

### K42, the weight
- The tower builds up from the desk, course by course. The cold fog thickens with it.
- The warm beam rises out of him into Claude and pulses slowly, once per 2 s, as if drawn.
- The motes travel up the beam and cool from amber to blue as they rise.

### K45, he built that
- Hard cut on "HE" (166.00) to the building already there.
- The facade's lit rooms switch on in the pattern of the envelope, row by row from the bottom (0.08 s per floor), then the calendar.
- The camera tilts up 4%.

### K50 → K52, hands behind the head (no pops)
- The performance's arm rise (s03 33.4–34.6) is natural. The laced-hands correction blends in from 0 to 1 over that same 1.2 s, so the hands land behind the head without snapping.
- The performance jumps to a different pose at s03 36.9 s. The held time must stay under 36.85 for the whole of K50–K52; the animation driver clamps it.
- K51 and K52 are cuts in on the same pose, so there is no motion across them.

## 3. What has to be built before animating

1. A **transition driver** in `scene.js`: `tin` and `tout` per shot (`kind`, `dur`, `at`), evaluated in `props(t)`. It drives `dim`, zone fades, the imagination ramp, `build`, fall-away offsets and the bokeh stretch. Shots stay data; motion is a curve on top.
2. **Births**: `born` positions per element, an arc tween, a per-element light.
3. The **fall-away rig**: wall, floor and shelf groups get an offset and opacity driven by `tin`.
4. **Page and particle drift** in the drowning (seeded, deterministic per frame so renders repeat).
5. A **camera move pass**: give each held keyframe its one move (push, drift or rise), keeping `from`/`to` and `at0`/`at1` as they are.
6. A **blur review**: focus pulls keyed to the beats, and no subject soft at its key moment (see `AUDIT_R7B.md`, cross-cutting cause 2).

The renders for review come after this, as an MP4 from `tools/render_mp4.mjs --scene kf1` at 1280×720, with the VO.
