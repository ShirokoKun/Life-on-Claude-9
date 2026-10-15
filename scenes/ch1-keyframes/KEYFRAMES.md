# Chapter 1 keyframes, round 8: the lock pass

**Scene:** `kf1`, Studio scene 5, "Chapter 1 · Keyframes". Module: `engine/scenes/kf1/scene.js`.
**Clock:** the real Ch 1 voiceover (`ch01_full_mix.mp3`), 201.64 s.
**Board:** `board/ch1_keyframes_r8.jpg` (round 6: `board/ch1_keyframes_r6.jpg`).
- 56 frames at 1280×720, rendered 2026-10-15 in 171 s on the GTX 1650.
- Single frames: `renders/kf1/r6/<id>.png`.
- Round 4 is kept for comparison: `board/ch1_keyframes_r4.jpg`.

**Sources for this round:**
- the director's storyboard, "IVAN vs AI" (4 rows × 9 panels, each captioned with its script lines);
- the render references in `IVAN vs AI _ Short Film(1).zip` (11 sheets: sketch panel + target render);
- the director's notes on round 4.

Every frame was rendered and looked at. Real-time playback and sound were not checked.

## How to look at it

1. **Story reel:** the Studio, scene 5, Play. Each frame holds for its line on the real voiceover.
2. **Re-render the board:**
   ```
   node tools/kf_board.mjs --take r7 --gpu
   ```
3. **Frames side by side:**
   ```
   python -I tools/kf_pick.py renders/kf1/r6 out.jpg K30 K33 K35
   ```
4. **Where Ivan's head is in any frame:**
   ```
   node tools/kf_heads.mjs K33
   ```
   Aim cameras at the measured point, not at a guess.

## What the references say (and what was taken from each)

| Reference | What it is | Taken into |
|---|---|---|
| `Editing_image…` | CG Ivan in a dark room: face lit from the screen, monitor edge in the foreground, lamp and bed soft behind | K06 (the monitor edge in the foreground, his face over it) |
| `Group 5` / `Group 10` / `Group 11` | Ivan from behind or in low profile; rings of light streaks circling overhead like a long exposure; teal and orange on black; his hair edged with light | K26, K27: the **dome** mode (streaks laid along rings, very shallow focus, a warm rim and a cool rim) |
| `Group 6` / `Group 7` | Seen from straight above, he looks up at us; soft bars of red, orange, peach and cyan around him at every depth | K25: **down** mode, head lifted to the lens. The same high angle is reused, pale, in K46. |
| `Group 9` | The desk, chair and screens alone in black, from a high three-quarter behind | K21a–d, K22, K38: the **iso** void (room hidden; desk, chair, screens and Ivan stay) |
| `Group 12` / `Group 8` / `randomgen…` | The mug scenes on a **balcony**: dark rail, sliding glass door, slab overhead, city towers as bokeh; warm light from the flat on his face; his face and hands breaking into flat facets | K30, K33, K34, K35: the **balcony** set (new) with a mug in his hand. The faceted look is not in yet (see below). |
| The storyboard | Panel order and what each line shows | Every non-experimental frame; panel ids in the table below |

**The palette across all of them:**
- teal against orange, on near-black;
- warm light is human (the flat, the lamp, the sun);
- cool is the machine and the night.

The cheat-code world (K24) moved from pink and violet to teal and orange.

## Round 8: the lock pass (2026-10-15/16)

Sources: the director's notes on r6/r7, his three new references (the eye with light in the glasses, the man drowning in paper, a real glass of water), and a frame-by-frame audit (`AUDIT_R7B.md`). The plan for the world crossings is in `TRANSITIONS.md`.

**Imagined frames get their own texture.** `imagPass` (added by the scene after the film grade, k = 0 on normal frames) adds a stipple grain, a soft posterise and an optional duotone. Each world has its own strength (`ZONE_IMAG`); the eye frame wears it fully.

**Rebuilt after the director's references:**
- **K29**, the eye: low 3/4, rust print grain, coloured streak bars across the lower lenses (a planar lens map, `lensUv`).
- **K13**, drowning: the room drops to a void around his chair; about 950 glowing pages at every depth, specks, dark fog; he sits back, hands on his thighs.
- **K04 / K03 / K47**, the glass: the old glass was a 7% film that wrote no depth, so the lens blurred it like the wall behind; the water was frosted. Now the water is clear (it refracts), the glass is a Fresnel shell that writes depth, with a rim, a base and a meniscus.

**Rebuilt after the board panels:**
- **K02:** the side eye, 3/4.
- **K07:** the screen fills the frame (r1c5).
- **K10:** his face in the screen's light, Claude over his shoulder (r1c6).
- **K11:** a clean top-down.
- **K12:** leaning back, phone up, one chat card (r1c7).
- **K24 cheat world:** a night void (black to dark violet, black floor with a white grid, stars, gems, glyphs; no lamp).
- **K42:** a stepped stack of modules, Claude clear at the top, Ivan at its foot.
- **K45:** a real office block.

**Posture:**
- Mug sips follow drinking kinematics: elbow down and forward, neutral wrist, a handle grip, the mug turned to meet the hand.
- New seated-back posture (`lean` plus hands on thighs, `armrest`).
- New pointing finger (`point`, K43).

**Fixes:**
- `kf_board` renders every frame twice (the lens kept the previous shot's focus).
- The ghosts are spread out and tinted.
- The soft pool of light replaces the hard disc (K25).
- The lamp is hidden in every zone.
- K08 sticky notes cleared with the per-shot `hide` list.
- K31 phone fully lit.
- K39 cold under-light.
- K41 code lines kept low in the lens.
- K44 seated glasses.
- K46 contact shadow with the building hidden.
- K49 Claude sits on the monitor.
- K51/K52 on his axis.
- K16, K36, K43 given distinct angles.

## What changed from round 4

- **Line by line onto the board.** The void now starts where the board starts it:
  - V15 is the cheat code, kept as the experimental frame;
  - V16: standing among soft bars, seen from above;
  - V17: the ring dome, then the door, then the eye with the streaks in its lenses (board B r4c1).
- **V13 (the four modules) happens in the void, as asked.**
  - K21a: the room goes dark around the desk.
  - K21b–d: only the desk, chair, laptop, screens and Ivan remain in black.
  - The pixel modules arrive one by one, each with its own glow and a small light of its own colour.
  - The same void frame returns for "a few hours of coding" (K22, the ghosts) and for "It's not all pleasant" (K38, empty).
- **The panels on his head are gone.**
  - K18 ("once the email system was working"): the pipeline is now pixel objects (inbox → sort → draft → you, ticked green) floating in front of his blurred face in a room sunk to dusk.
  - K15 (the offer): the same objects assemble above the desk while Claude presents them.
- **K11 → K12 connect.** The day top-down already shows the unread mail piling around his chair. K12 pushes in to him, phone up, the chat floating beside him in the afternoon, the envelopes swarming.
- **A phone in his hand** (two-bone IK in the engine, no new acting): K12–K14, as on board A.
- **The balcony** (new set, built in code): night city, rail, glass door, warm interior light. The mug is in his hand in K30, K33, K34 and K35.
- **Standing poses are fixed:**
  - feet planted on the floor (the legs no longer sink);
  - arms hang naturally;
  - the head lifts for the looking-up frames.
- **Bone edits no longer leak** from one frame into the next.
- **Lighting:**
  - Claude's light is halved (it was blowing out K13 and K16);
  - the daylight macro was brought down;
  - the dawn has a warm window light and a window-bar cookie on him;
  - "pure satisfaction" washes his face cyan-white (board r4c4).
- **The REVIEW + APPROVE note** reads again (the desk lamp's shadow had turned it black).
- **Code in his lenses** (K41) and **streaks in his lenses** (K29), as on boards C r3c4 and B r4c1.

## The keyframes, with the board panel and the way into each frame

Board panels are numbered by row (r1–r4) and column (c1–c9). The original boards A, B and C are named in brackets.

| Key | Time (s) | VO | Board panel | Into this frame |
|---|---|---|---|---|
| K01 Three AM | 0–3.0 | pre-roll | (establishing) | fade up from black |
| K02 Hasn’t eaten since lunch | 3.0–7.8 | V01 | r1c1 (B r1c3: the side eye) | cut: from the room to the eye |
| K03 Six hours ago | 7.8–12.7 | V02 | r1c2 (A r1c2) | cut |
| K04 Still full | 12.7–15.6 | V03 * | r1c2 | cut in (same axis, tighter) on the sub drop |
| K05 Hunched over his laptop | 15.6–18.3 | V04 a | r1c3 (B r1c2: from behind) | cut: wide, from behind |
| K06 Eyes bloodshot | 18.3–20.9 | V04 b | r1c4 (the photo ref; render ref Editing_image) | reverse: from the screens back at him |
| K07 A terminal, a chat, scripts | 20.9–26.6 | V05 | r1c5 (A r1c4, green screen light) | cut: over the shoulder |
| K08 Email automation system | 26.6–30.3 | V06 | r1c5 (A r2c1, the label) | cut: tilt up to the monitor |
| K09 Claude is doing the building | 30.3–34.9 | V07a | r1c6 (experimental, kept) | cut: down to desk level on the chime |
| K10 Ivan keeps saying yes | 34.9–37.9 | V07b * | r1c6 | cut on the hit (36.25) |
| K11 Two days ago | 37.9–41.9 | V08 | r1c7 (flashback) | match on K01: the same top-down, the night drains into day |
| K12 400 unread | 41.9–46.4 | V09 a | r1c7 (A r2c4 “complaining to claude”) | push down from the top-down into him |
| K13 Drowning here! | 46.4–50.8 | V09 b | r1c7 | cut: over his shoulder onto the phone |
| K14 Hello, Claude | 50.8–55.3 | V10 a | r1c8 (A r3c1) | cut on the chime (51.01) |
| K15 The offer | 55.3–60.0 | V10 b | r1c9 (MOTION GRAPHICS) | the room dims; the offer builds in the air |
| K16 Want me to build one? | 60.0–63.8 | V10 c | r1c9 | cut: down to the keys |
| K17 Review and approve | 63.8–68.5 | V11 * | r1c9 | smash cut to 3 AM on the sub drop (64.11) |
| K18 Once the email system was working | 68.5–71.2 | V12 a | r2c1 (B r2c1) | dissolve by light: the room sinks to dusk, the pipeline lights |
| K19 Hands on the keys | 71.2–72.6 | V12 b | r2c2 (B r2c2) | cut: the pipeline clears, the same axis |
| K20 What else was possible | 72.6–74.1 | V12 c | r2c3 + r2c4 (B r2c3/r2c4) | cut in: the same axis, onto the eyes |
| K21a Calendar management | 74.1–75.9 | V13a | r2c5 (B r3c1; render ref Group 9) | the room fades to black around the desk |
| K21b Meeting scheduling | 75.9–77.65 | V13b | r2c5 | the same frame: the room is gone |
| K21c Document drafting | 77.65–79.6 | V13c | r2c5 | the same frame |
| K21d Research summaries | 79.6–81.8 | V13d | r2c5 | the same frame |
| K22 A few hours of coding | 81.8–85.2 | V14a | r2c5 | the same frame: time-skip tick (82.07) |
| K23 Another task gone | 85.2–89.9 | V14b | r2c5 | cut: back in the room, over his shoulder |
| K24 A cheat code for life | 89.9–93.8 | V15 * | r2c6 (experimental, kept; teal-orange) | the walls fall away on the rush (90.59) |
| K25 Hours into minutes | 93.8–97.4 | V16 | r2c7 (B r3c3; render ref Group 6/7) | the desk drops away; he is standing in the dark |
| K26 A different frequency | 97.4–100.9 | V17 a | r2c8 (B r3c4; render refs Group 5, 10) | cut: from above to below and behind |
| K27 Than everyone around him | 100.9–103.0 | V17 b | r2c8 (render ref Group 11) | cut: round to his profile |
| K28 Stepped through a door | 103.0–104.4 | V17 c | r2c9 (experimental, kept) | the rings straighten into a tunnel |
| K29 Others can’t even see | 104.4–105.35 | V17 d | r2c9 (B r4c1: the eye) | cut in to the eye; cut dead at the vacuum (105.15) |
| K30 He’s barely slept | 105.35–109.9 | V18 a | r3c1 (C r1c1; render ref Group 12) | from black (the vacuum): the phone buzz (105.65) brings the night back, outside |
| K31 She stopped texting | 109.9–112.8 | V18 b | r3c2 (C r1c2) | cut: inside, the phone on the desk |
| K32 Responds to everyone else | 112.8–117.7 | V19 | r3c3 (C r1c3) | focus pull: phone to laptop (same frame) |
| K33 He knows | 117.7–121.6 | V20 a | r3c4 (C r1c4; render ref Group 8) | cut: back out on the balcony, close |
| K34 A thinness to his thoughts | 121.6–126.3 | V20 b | r3c5 (C r2c1; render ref Group 7 bottom) | the same frame: the city stretches into lines |
| K35 Close to something | 126.3–129.4 | V21 | r3c6 (C r2c2; render ref Group 8 bottom) | cut: round behind his shoulder |
| K36 One more module | 129.4–133.2 | V22 (Ivan) | r3c6 | cut: back at the desk, the keys |
| K37 Then he’ll rest | 133.2–136.9 | V23 | r3c6 | cut: reverse, the bed |
| K38 It’s not all pleasant | 136.9–140.0 | V24 a | r3c7 (C r3c1; render ref Group 9) | time-skip tick: the room falls to black (the K21 frame again) |
| K39 Eyes burn | 140.0–143.4 | V24 b | r3c8 (C r3c2) | cut: low, from behind the screens |
| K40 Hands shake | 143.4–147.4 | V24 c | r3c9 (C r3c3) | cut: top-down |
| K41 Doesn’t fully understand | 147.4–152.4 | V25 a | r4c1 (C r3c4) | cut in: his eyes |
| K42 It takes something from him | 152.4–158.0 | V25 b | r4c2 (W.I.P.; experimental, kept) | the walls fall away again, cold |
| K43 Finishes another module | 158.0–162.2 | V26 a | r4c3 (C r4c1) | cut: macro, the finger |
| K44 Pure satisfaction | 162.2–165.7 | V26 b | r4c4 | cut on the pass chord: the screen flares |
| K45 HE... built that | 165.7–168.6 | V27 a * (Ivan) | r4c5 | hard cut on “HE” (166.00): white |
| K46 What HE told it to do | 168.6–172.4 | V27 b (Ivan) | r4c6 | cut on the drop (168.85): from above |
| K47 Dawn | 172.4–175.2 | V28 a | r4c7 (MOTION GRAPHICS) | the vacuum (171.94), then dawn rises (173.28) on the K04 frame |
| K48 By sunrise | 175.2–177.8 | V28 b | r4c7 | match on K01 / K11: the third top-down |
| K49 Calendar, documents, reading | 177.8–182.5 | V28 c | r4c7 | cut: from behind, the desk wall |
| K50 Exhausted and wired | 182.5–188.8 | V29 | r4c8 (C r4c4) | cut: in front of him |
| K51 Then he realizes | 188.8–192.4 | V30a | r4c8 | cut in on the same axis |
| K52 What he’s supposed to do now | 192.4–195.5 | V30b * | r4c9 | cut in again: his face, nothing to do |
| K53 Black | 195.5–201.64 | tail | (end) | cut to black on the vacuum (195.52) |
## Transitions (how the picture moves from one world to the next)

These are the planned moves for when the keyframes become shots. They are written per frame in `scene.js` (`tr`).

| Moment | Transition |
|---|---|
| K01 → K11 → K48 | **Match on the top-down:** the same camera at night, in the afternoon and at sunrise. The light changes and nothing else. |
| K17 | **Smash cut** to 3 AM on the sub drop. |
| K18 | **Dissolve by light:** the room sinks to dusk while the pipeline lights up. |
| K21a → K21b | **The room fades to black around the desk**, in the same locked frame. The modules then arrive one per ping. |
| K23 → K24 | **The walls fall away** on the rush: room → cheat world, with the desk as the anchor. |
| K24 → K25 | **The desk drops away:** he is standing alone in the dark. |
| K28 → K29 | **The rings straighten into a tunnel**, then a cut in to his eye. Cut dead at the vacuum (105.15). |
| K29 → K30 | **From black, the phone buzz brings the night back**, outside on the balcony. |
| K37 → K38 | **Time-skip tick:** the room falls away to the iso void again (the K21 frame, now empty). |
| K41 → K42 | **The walls fall away a second time**, cold: the tower. |
| K44 → K45 | **Hard cut on "HE"** into white: the monolith. |
| K46 → K47 | **The vacuum, then dawn rises** on the K04 glass. |
| K52 → K53 | **Cut to black on the vacuum** (195.52); the hollow chime plays over black. |

## Still weak (fix next)

| Keyframe | What's wrong |
|---|---|
| **K33, K34 and the faceted look** | The references break his face into flat blocks. A runtime shader on the high-detail scan produced colour garbage, so it is **off** (`pix.js` stays, unused). The real fix is a decimated low-poly copy of Ivan, made once in Blender and swapped in for these frames. The mug also clips into his lip slightly in K33 and K34. |
| K02 | The eye close-up is from the front, not the board's side profile; his hair hides the eye from the side in this hunched pose. |
| K13 | The phone arm reads stiff. |
| K19 | His hands on the keys are out of frame. |
| K24 | The desk lamp is in the cheat world (it is baked into the desk mesh). |
| K25 | The soft bars are sparse and hard-edged next to the reference. |
| K38 and K21 | The void reads navy, not black, because of the film haze in `post.js` (locked). |
| K40 | The mug in his left hand is barely in frame, and the shake doesn't read in a still. |
| K42 | Claude is half buried in the tower. |
| K44 | The amber background of board r4c4 is missing. |
| K51 / K52 | Too alike; vary the second one, for example a profile. |
| The board's "MOTION GRAPHICS" panels (r1c9, r4c7) | They are 3D pixel objects here (the pipeline, the modules). Separate motion-graphics passes can still replace or overlay them. |

## Decisions for you

1. Build a **low-poly Ivan** for the faceted "fraying" frames, as in the balcony references? It takes about one Blender session: decimate, then bake his texture down.
2. **K02:** keep the frontal eye, or move it to a different pose where the side eye is visible?
3. **V16:** is the board's "standing among bars" frame (K25) right for "hours into minutes"? Round 4 used the "38h saved" dashboard here.
