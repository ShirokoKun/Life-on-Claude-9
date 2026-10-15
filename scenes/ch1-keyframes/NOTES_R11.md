# Director's notes on the animated preview `anim2` (2026-10-16), round 11

The director's timestamps after the first minute are minutes and seconds ("1:15" = 75 s). Each note below is mapped to its shot and then to a fix. Status: `[ ]` open, `[x]` done and checked in a still or strip.

## Root causes behind many notes
- [x] **The "looping" head moves (K06 at 19 s, K15 at 58–59 s):**
  - The performance's **"read" spans** (s03 15.2–16.2, 19.4–22.4, 25.0–26.8; s04 15.4–24.8) sweep the head along lines of text and snap back. Seen in a shot, that reads as a cyclic, lagging loop.
  - K05, K06 and K07 replayed overlapping windows of the same clip, so the same move ran three times across the cuts.
  - Fix:
    - Play windows only from the **"type" spans**, one continuous clock across consecutive shots.
    - Keyed, slow head turns (`lookK`) for every deliberate look.
    - The clip loops (LoopRepeat), so no window may pass the clip's end (s03 37.0 s, s04 31.29 s).
- [x] **"Ivan isn't typing" (K07, K10, K32 and others):** windows were chosen by time, not by the typing data. Fix: typing shots use the typing spans (s03 0.4–5.6, 6.2–9.4, 10.0–13.2, 13.8–15.2, 16.4–19.4, 22.4–25.0, 30.2–31.2; s04 0.2–3.0, 5.1–8.5, 10.4–12.8, 26.9–31.2).
- [~] **"The eyes look weird" (nearly every face shot):** the glasses lens is a *transmission* material. Three.js renders it from a lower-resolution, softened copy of the scene, so the eyes behind it go milky, flat and blurred. Fix (kf1 only, at runtime): clear thin glass with Fresnel edges and a specular glint. The eyes then render directly.

## Per shot
| Time (s) | Shot | Note | Fix |
|---|---|---|---|
| 3–8 | K02 | eye close-up: position, framing and blur look weird | reframe: eye centred inside the rim from 3/4, a little wider, focus on the iris, clear lens |
| 15–18 | K05 | he should start sitting casually, then focus on the screen and lean in | lean keyed from back to forward; head lifts to the screen; typing span |
| 18–21 | K06 | head motion loops; should be slow: head down, then slowly up to the big screen | type-span window, no read span; `lookK` slow lift over ~2 s |
| 21–27 | K07 | terminal, chat and scripts could show better; the camera is still and nothing happens; his hand isn't typing | camera moves across the three things; the screen content animates; his typing hand in the foreground |
| 35–38 | K10 | hands and body move weirdly | typing span, not a jump across poses |
| 44 | K12 | he looks away, not at his phone | gaze locked on the phone (head and eyes) |
| 44–47 | K12 → K13 | the cut looks weird | **cut on motion**: K12's camera orbits toward K13's side; the cut lands at the orbit's fastest point, and K13 starts moving at the same speed and eases out |
| 47–51 | K13 | pages float up too fast; should rise slowly and keep rising | continuous slow rise (bottom to top, the whole shot); no fast waves |
| 48 | K13 | not looking at the phone; hand posture bad | head and eyes to the phone; grip check |
| 51–55 | K14 | hand posture; he should look at the phone first, then slowly turn his head to Claude as it appears | `lookK`: phone, then a slow turn to Claude after its birth |
| 58–59 | K15 | head loops left to right | hold instead of the s04 read span; a slow follow of the modules |
| 1:15–1:16 (75 s) | K21a | the transition into the void should be slower: the room slowly darkens and dims; the elements should pop in better; the camera can move during it | longer dim ramp (~2 s); camera drift through it; icons born with glow, scale and bounce |
| 1:23–1:24 (83 s) | K22 | the ghosts' chairs look bad, and Ivan has no chair; the ghosts could be doing their own actions | real Ivan's chair visible; ghosts animated (typing, slumping), chairs softer |
| 1:25–1:30 | K23 | on-screen tick animations as tasks are removed | animated TODO ticks |
| 1:30–1:31 (90 s) | K24 | the code should build itself over time; the background should move; the up/down keys look chaotic | remove the glyph code; slow build of the world; moving background |
| 1:33–1:34 (93–94 s) | K24 → K25 | the transition isn't working; the light rays at 94 s don't move; they should be glitchy light rays moving | animated bars: slide, then accelerate (slow, then fast), glitch and trails |
| 1:38 (98 s) | K26 | the rings should move and glitch, rotating round him like the Earth | rings rotate round him; glitch jitter |
| 1:40–1:45 | K27–K29 | flow better; K28 (1:43–1:44) needs more time to register, with light-ray motion | retime K28 longer; tunnel rays moving |
| 1:45–1:50 | K30 balcony | the cup doesn't move with the hand, and the hand moves randomly; he should drink: cup and hand slowly down, then slowly up, a sip | hold pose; animate the sip as a keyed mug path with the hand IK following |
| 1:50–1:51 (110 s) | K31 | still camera; orbit slowly upward round the phone at the centre | orbit move |
| 1:52 (112 s) | K32 | the cards/envelopes aren't composed and don't show | envelope stream in frame |
| 1:54 (114 s) | K32 | not typing; hand weird | typing span; check angles |
| balcony shots | K30, K33–K35 | the cup and the light on his face look weird | check the grip in motion; soften face light |
| (all) | glitch lights | they appear suddenly; they should slide in like a displacement map, trail, start slow and then go fast | ramp in the speed and opacity of the bars and rings with trails |
| 2:15 (135 s) | K37 | "Then he'll rest": start on Ivan working, then the camera slowly pans to his bed | pan from desk to bed |
| 2:18–2:19 (138 s) | K38 | too much random negative space; reposition | reframe the void desk |
| 2:23 (143 s) | K40 | a random "hat" on the coffee mug; he seems to sit on the table; random camera moves | remove the mug ghosts (the shake doubles), fix the framing, lock the camera |
| 2:20–2:32 (140–152 s) | K42 | the block of light (the beam) looks bad | remove the beam |
| 2:38 (158 s) | K43 | he can tap Enter on the laptop | animated finger press on Enter |
| 2:43 (163 s) | K44 | the eyes look weird | lens fix |
| 2:50 (170 s) | K46 | a slow dolly zoom while he looks up | dolly zoom (push in while widening the lens) |
| ~3:00 (180 s) | K49 | Claude has no colour; the frame looks sharp and flat; needs contrast | saturate the hollow Claude (warm but dim); a contrast grade for the scene |

## Status (2026-10-16)
**Done and checked in stills:**
- Play windows rebuilt from the type spans; keyed head looks (`lookK`) and lean (`leanK`).
- **Faces:** clear lenses; gaze on the phone (K12/K13, measured with `tools/_probe_look.mjs`); K14 turns from the phone to Claude; K06 lifts slowly from head-down to the monitor; K15 follows the modules.
- **K12 → K13:** cut on motion (orbit eases in to the cut, the next orbit eases out); pages rise slowly and continuously.
- **Screens and K07:** K07 is over the shoulder with his hands typing and the screen; every screen's content runs on through its shot.
- **The void and its shots:** K21a dims slowly; K22 ghosts act and Ivan has his chair; K23 ticks.
- **Light worlds:** K24 loses the glyph line and its grid builds outward; K25–K28 light rays slide in, accelerate, trail and glitch; the K26 rings turn on a tilted axis; K28 is longer and its tunnel streams.
- **Balcony and phone:** the K30/K33/K35 sips are keyed; K31 orbits up round the phone; the K32 envelopes stream up from the laptop in frame.
- **K37 to K49:** K37 pans from him to the bed; K38 is tighter; K40 has no ghost mugs and keeps a tremor; K42 has no beam; K43 has an Enter press; K46 has a dolly zoom; K49's Claude is warm with a contrast grade (K48–K52).
- **Bug:** NaN black-block flicker fixed in the skin shader (the hair mask is clamped).

**In progress:** real eyeballs in the Blender model (`--eyes` in prep_tripo.py, staging `ivan_eyes.glb`), then K02 reframed on the new eye.
