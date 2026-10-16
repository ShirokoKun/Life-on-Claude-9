# Round 14: the director's notes, as a checklist (2026-10-16)

Every note from round 14, one line each, with where it came from, who builds it, and how to check that it is done.
Tick a box only after the change has been **seen in a render** (board frame or the 720p review film), not when the code is written.

**Sources**
- **S** = the Studio notes (`NOTES.md`, left in the player, K01–K16).
- **V1** = voice notes, message 1 (K15–K53) + references R1–R3.
- **V2** = voice notes, message 2 + references R4–R5 + "checklist, agents, low-quality video".

**References** (`reference/r14/`)
- **R1** `room_bed_rug_ref.webp`: Ivan's room. Dark green walls, a navy bedsheet with real cloth texture, a beige pillow, a Persian rug, dark polished wood floor, the guitar, Crocs on the rug.
- **R2** `rug_pattern_ref.webp`: the rug. A red Persian medallion, a black field round it, worn and faded.
- **R3** `white_outline_icons_ref.webp`: the icon style. Pixel icons made only of white outlines and white lines (no fill, **no black**), with a soft inherent glow and dotted arrows between them.
- **R4** `balcony_mug_city_trails_ref.webp`: the balcony.
  - The mug is gripped round its **body** in a loose fist.
  - The glasses glow warm from reflected light.
  - The city's bokeh discs **stretch into horizontal light trails** behind him.
- **R5** `topdown_foreground_lines_ref.webp`: the top-down shot (K25).
  - Ivan is sharp, looking up.
  - Two or three bars of light (code-like, orange/red) pass right under the lens, **extremely blurred**.
  - The behind shot (K26): the streaks curve round him like a tunnel.

**Lanes** (who builds it; each lane works on its own branch)
- **L0** structure and cameras (`kf1/scene.js` SHOTS, flows, framing), integration, boards, the film. *Main session.*
- **L1** the white outline icons + Claude's form (`kf1/lineicons.js` new, `props.js`, `claude.js`, `spark.js`).
- **L2** the imagined worlds (`kf1/stage.js`): K21 void, K24, K25–K27 per R5, K29 eye light, K34 trails per R4, K45.
- **L3** screens and small props (`ch1/screens.js`, `drawRefl`, the glass of water): K18, K31, K32, K41, K04.
- **L4** hands and acting (`kf1/rig.js`, `holdProp`, `tapEnter`, poses): K07, K12, K13, K30, K33, K35, K36, K40, K43, K50, K02 lids.
- **L5** the room and daylight (materials, window, sun, dust, shadows, bake): K11, K12, K47–K53, R1/R2.

---

## A. Global rules (apply to every shot)
- [x] **A1** (V1, S-K15) Every pixel icon in the film is a **white outline** icon after R3.
  - White lines only, no fill and no black.
  - An inherent glow.
  - Each icon must read as the exact word the VO says at that moment.
  - Applies to the pipeline (K15), review/approve (K16–K17), the modules (K21, K22, K49) and the life-ups (K24). *L1*
- [x] **A2** (S-K14) Claude is **always the voxel Claude character** (no starburst orb anywhere), and its glow is always on. *L1*
- [x] **A3** (V2) **Preview = render.** Find why the Studio's web preview differs from the video render, and fix it, so what the director sees in the browser is what the film renders. *L0*
- [x] **A4** (found 2026-10-16) The room dust shader does not compile (`res` undeclared in its vertex shader since round 11), so no dust has rendered since. Fix it: K48 needs dust. *L0*
- [x] **A5** (V2) Every change is checked in a render against its note and its reference, side by side, before it is ticked.

## B. Structure and timing (the shot list changes)
- [x] **B1** (V1) **K15 → K16 → K17 are one composition, no cuts.**
  - K16 and K17 keep K15's camera and framing.
  - K15: the four offer icons build.
  - K16: they flicker and go off, and the **review** and **approve** motion graphics come on in the same place.
  - K17: a slow **zoom in to the review and approve icons**.
  - No other shots or cuts inside K16–K17, so the smash cut to 3 AM and the sticky note go. *L0 + L1*
- [x] **B2** (V1) **K28 is removed; K29 takes its place** (102.30–105.35).
  - The line "like he's stepped through a door that others can't even see" is all on K29.
  - The vacuum cut at 105.15 stays. *L0*
- [x] **B3** (V1) **K37 is removed; K36 runs to K37's end** (129.40–136.90).
  - It carries "One more module. One more integration." and "Then he'll rest."
  - K36 ends after "Then he'll rest". *L0 + L4*
- [x] **B4** (V1) **K51 + K52 are one shot** (188.80–195.50).
  - A top shot, the camera directly over his face, which looks straight up at the ceiling.
  - One constant zoom from a wide to a very close-up. *L0*

## C. Shot by shot

### K01–K14 (Studio notes)
- [x] **K01** (S) Ivan in the **centre** of the composition: change the camera angle. *L0*
- [x] **K02** (S)
  - The glasses are lost in blur: make them read clearly, as part of his face (focus and depth of field). *L0*
  - The pixel-break glitch on the eyelids (from the new eye model): fix the lid area, and check it from closer views. *L4*
- [x] **K04** (S) Random circular elements on top of the water level: find them (leftover rings from earlier tests) and remove them. *L3*
- [x] **K07** (S) Hands on the keyboard: more open, aligned with the keys; check the hand positions and the typing motion. *L4*
- [x] **K08** (S) The camera angle is bad. The segment is about the screen showing the automation being built, so the screen where the actions happen must be visible. *L0*
- [x] **K11** (S, R1, R2) The room after R1: *(round 14: rug, cloth bed, pillows, oak floor done; the bed is cleaner and woven but still short of R1's softness)*
  - the rug (R2), the bed design, the textures and material behaviour of the floor carpet and the bed;
  - a better bed shape where the wavy design is, on the bottom parts;
  - the floor mattress more like cloth;
  - better pillows. *L5*
- [x] **K11** (S) Fix the camera angle in the screenshot.
  - Outside the window the day environment looks dark, with colours all over the place.
  - Light should come in through the window: try god rays (volumetric light), test and tweak. *L5 (+ L0 camera)*
- [x] **K12** (S) The starburst orb becomes the **Claude character**. *L1*
- [x] **K12** (S) The outside lighting is wrong: a night look in a day scene. Find the bugs. *L5*
- [x] **K12** (S) Light comes in from the window too: interesting, not overwhelming. *L5*
- [x] **K12** (S) The phone in his hand overlaps it: place it correctly (try several angles and takes). *L4*
- [x] **K13** (S) The left hand, the one not holding the phone, is bent wrongly at the wrist. Fix its rig angles and check from several cameras. *L4*
- [x] **K14** (S) The starburst becomes the Claude character, and its glow is always there. *L1*

### K15–K22
- [x] **K15** (S, V1) Only **outlined white glowing icons** after R3 (inbox, sort, draft, you: each must read as its word). **Remove the Claude orb** from this keyframe. *L1 + L0*
- [x] **K16** (S, V1) Same frame as K15.
  - The four icons flicker off.
  - **Review** and **approve** icons come on, with an action that means "you review, then approve" (e.g. a page checked over by an eye or magnifier, then a tick stamped). *L1*
- [x] **K17** (V1) Same frame; zoom in to the review and approve icons. *L0*
- [x] **K18** (V1) "once the email system was working": instead of the current frame, the **laptop screen**, with **many "email sent" notifications popping up**. *L3 + L0*
- [x] **K21a–d** (V1)
  - **A full void from the first frame** (no room fading out at the start).
  - Ivan and the desk in the void, not in a room.
  - The icons **small, outlined, white, glowing** (not colourful or big).
  - One pops up per line: calendar, meetings, documents, research. *L0 + L1 + L2*
- [x] **K22** (V1) "Each one a few hours of coding": **Ivan typing on the keyboard**. The see-through ghost Ivans go. *L0*

### K24–K29 (the imagined worlds)
- [x] **K24** (V1) "a cheat code for life", rebuilt:
  - no grid forming under him;
  - no camera orbit;
  - a frame that says **Ivan figured it out**;
  - out of this world and unreal, **not in his room**. *L2 + L0*
- [x] **K25** (V1, R5) The top shot.
  - **No lines through his body.**
  - Lines only in the **foreground**: two or three pass the camera very close, **extremely blurred**.
  - Ivan in **extreme focus**, looking up at the lines. *L2 + L0*
- [x] **K26** (V2, R5) Behind Ivan: the streaks **curve round him**; as the camera moves behind him you see the curves turn into straight lines. Lights very close to the lens are extremely blurred; Ivan stays sharp. *L2*
- [x] **K27** (V2, R5) The same light language: near lines heavily blurred in the foreground, Ivan in focus, looking at the lines. *L2*
- [x] **K29** (V1, V2) In K28's place.
  - An **extreme close-up of his eye and glasses**.
  - The glasses more visible to the camera, with the reflections of the glowing lines seen in them.
  - The camera **orbits from the right side of his face to the middle** while the reflection **slides left to right, horizontally**. *L0 + L2/L3*

### K30–K36 (balcony, R4)
- [x] **K30** (V1, R4) *(the city is closer to R4 but its bokeh is still denser than the ref: the lens blur is locked)*
  - Once the mug goes up, **it stays up**: he keeps drinking.
  - The hand grips the mug body as in R4. *L4*
  - The glasses glow warm (R4). *L3*
- [x] **K31** (V1) No orbit: **just a zoom in on the phone**. The lit phone **turns off** ("she stopped texting"). *L0 + L3*
- [x] **K32** (V1) **No Ivan in the frame.** Only the laptop, sending emails to everyone, automatically. *L0 + L3*
- [x] **K33** (V1, R4) The hand glitch: the hand stays on the cup, constantly, while he drinks. *L4*
- [x] **K34** (V1, R4)
  - No extra lines coming in from outside.
  - Only the **blurred city lights themselves** turn into white lines: each bokeh disc stretches from a circle into a long line and streams **behind Ivan**, like light trails. *L2*
- [x] **K35** (V1, R4) The hand glitches again: keep the hand fixed on the mug. *L4*
- [x] **K36** (V1)
  - Not the typing shot: a **zoom in to his mouth drinking the coffee**.
  - On "One more module" and on "One more integration" he **gulps one sip each time**.
  - The hand is locked to the mug, the mug locked at his mouth.
  - Runs over K37's time (B3). *L0 + L4*

### K40–K45
- [x] **K40** (V1; he said "K48", the line is "hands shake from a caffeine overload")
  - An **over-the-shoulder** shot.
  - The **mug in his right hand**, the **left hand on the keyboard** coding.
  - The right hand shakes **slightly and slowly** (now too much, too fast). *L4 + L0*
- [x] **K41** (V1; "Kate, what do you want…" = K41)
  - Tighter: **only his eyes and the glasses**, nothing below the nose, nothing above the forehead.
  - In his lenses, **code in English turning into symbols and blocks**, like an encrypted message. *L0 + L3*
- [x] **K43** (V1) The click is wrong: the finger bends too much. Keep the hand in one place and **move it straight down** so the finger presses the key. *L4*
- [x] **K45** (V1)
  - The machine is too big to see: show **at least 95% of the machine**, its outer edges inside the frame.
  - Ivan can sit in a corner of the frame.
  - Keep the big size contrast. *L0 + L2*

### K47–K53 (dawn and day)
- [x] **K47** (V1) A **sunlight beam on the glass, moving from the bottom to the top**. *L5*
- [x] **K48** (V1, R1) *(round 14: sun, shadows, rays, dust done; the bed as K11)*
  - The **sun rays fall on Ivan**.
  - **Dust** in the room, a small atmosphere.
  - The earlier room notes apply: a more textured bed, fixed pillows, more textured mats.
  - **Shadows true to the sun's direction**: guitar, chair, bed, laptop, everything. *L5*
- [x] **K49** (V1) The **white icons'** focus and glow more prominent in the frame. *L1 + L0*
- [x] **K50** (V1; "In case of T…") *(round 14: the look up done; the bulky sleeves are not)*
  - He leans back and looks **straight up at the ceiling**, not to the side.
  - The sleeves were bulky (open since round 13). *L4*
- [x] **K51+K52** (V1) See B4. *L0*
- [x] **K50–K53** (V1) Outside the window it is **daylight** (now dark, a night), and **sun rays come into the room**, lighting Ivan and the objects round him. *L5*

## D. Delivery
- [x] **D1** (V2) After every batch, a before/after keyframe board (`renders/kf1/<take>/board.jpg`).
- [ ] **D2** (V2) A **low-quality review film** (720p, `render_mp4 --w 1280 --h 720`) shared here when all lanes are merged.
- [x] **D3** Commit each lane small and descriptive on `claude/wonderful-franklin-gzawe0`; tick `NOTES.md` lines as their fixes are seen.
- [ ] **D4** (director, 2026-10-16) **The proof sheet, before anything is called done.**
  - For every item above: the note's words, the BEFORE frame (`before14`), the AFTER frame, and the reference (where there is one), side by side, with a verdict.
  - Three passes over the whole checklist after merging. Pass 1 finds the misses; fix them. Pass 2 checks the fixes and their neighbours. Pass 3 is the final read against his words.
  - Nothing is reported as done that is not merged into the branch the Studio runs.

## Interpretations (say so if any are wrong)
- "K48 … hands shake from caffeine overload" → **K40** (the shot on that line).
- "Kate, what do you want … only his eyes and glasses" → **K41**.
- "In case of T, when he leans back" → **K50**.
- "make the focus and the glow of the white icons more prominent" → **K49**, the dawn icons on the wall.
- "R5 for K25, K26, K27 and K28": K28 is removed (B2), so the K28 slot is now K29. Its lens reflections use the same lines.
- K36 stays at the desk at 3 AM (the shot before K38's void desk). It is a close-up on the mouth and the mug.
