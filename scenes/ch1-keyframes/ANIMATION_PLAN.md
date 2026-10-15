# Chapter 1: animation and acting plan (K01 to K53)

Status: **reviewed and corrected against the round-10 keyframes** (2026-10-16); the continuity fixes it asked for in section 3 are applied in scene.js (K51/K52 at 36.8, K16/K18 dim 0.16, matched lenses in F1/F3/F4, K35 left hand). It turns the 56 held keyframes of `engine/scenes/kf1/scene.js` into shots that move. It adds no new keyframes and changes no file; every number is a proposal to be tuned by eye. Companion docs: `TRANSITIONS.md` (the crossing grammar and the round 9 notes in section 2b) and `KEYFRAMES.md`.

The brief in one line: **transitions must feel normal and smooth, not "transforming"; the cuts flow from shot to shot; some stretches are one continuous camera move; no camera movement is ever unintentional.**

Clock: VO seconds at 24 fps (1 frame = 0.042 s). Word times marked "~" are estimates (about 0.2 s); confirm them on the audio before locking.

---

## 0. The rules this plan follows

### 0.1 Camera
- **One move per shot.** A move is one of: **push** or **pull** (dolly along the lens axis), **truck** (sideways), **rise** (crane up, aim fixed), **tilt**, **orbit**, **track** (travel along a path). A **focus pull** is keyed separately and is allowed with a move. A **lens change** is only ever a cut, never inside a shot.
- **Percent = percent of the camera-to-aim distance** in `scene.js`, with the real distance in cm. Examples: K02 is 27 cm from the eye, so 3% is 0.8 cm; K11 is 3.40 m from the room, so 3% is 10 cm.
- **Easing:** every move eases in and out (smoothstep) unless it says "lands on". A move **lands** (ease-out, stops exactly) on the sound or action it is built for, then the shot holds.
- **Speed at a cut is zero** (the move has finished and eased out) unless the cut is inside a continuous flow (section 1).
- **A locked-off shot is a decision**, and the reason is written in the block: either the subject is already moving (Claude's orbit, pages, ghosts, a shaking hand) or the beat is a stop (K04, K47, K53).
- The camera never shakes. If something shakes (K40, the hand), the world shakes, not the lens.

### 0.2 Ivan (the acting system is locked; performances are added, never rewritten)
Ivan's acting comes only from three things: the existing clips (`s03`, `s04`), the held-time rule below, and small runtime offsets (head look and yaw, lean, hand IK to a prop or a point, finger curl, stand).
- **HOLD t** means the clip time stays fixed. Life then comes only from the offsets below.
- **PLAY a to b** means the clip time advances at 1.0x from `a` at the shot start. Never slow typing (slow-motion typing looks wrong); if a window is shorter than the shot, **play it, then hold the last pose**.
- **Forbidden zones in s03:** a window may not cross **33.3** unless it is K50 (the arm rise is s03 33.4-34.6, which only the "leans back" shots use), and nothing may reach **36.85** (the clip jumps pose at 36.9). All windows in this plan end at or below 33.3, except K50-K52, which stop at **36.80**.
- Every PLAY window must be scrubbed once (`window.__ivt`) for pops before it is locked. Windows that fail fall back to HOLD plus offsets.
- **Cuts hide pose differences. Continuous flows do not**, so inside a flow the clip time must be continuous (stated in the block).
- Shared offsets, deterministic (seeded) so renders repeat:
  - **breath**: spine pitch +-0.6 deg at 0.22 Hz (4.5 s), shoulders +-3 mm. Stressed: 0.4 Hz, +-1.0 deg.
  - **blink**: 0.16 s, every 3-5 s on a seeded list, never within 0.3 s of a keyword. Tired: a heavy blink of 0.35 s. (If the rig does not expose lids, the blink comes from the clip only. Check.)
  - **eyes**: look-at target; while reading, a saccade of 2-4 deg every 0.5-1.2 s, 0.1 s each.
  - **head**: +-4 deg around the shot's given `look`/`yaw`, unless the block says otherwise.
  - **fatigue**: head and lean droop 2 deg over 5 s on the tired beats.

### 0.3 Claude (`claude.js`: poses `hold, hover, wave, present, cheer, idle, sit`)
- **Birth (every time, TRANSITIONS section 1):** a spark leaves the calling device (0.2 s), the body assembles **bottom-up, voxel by voxel, 0.5 s**, one frame of overbright per layer; its light fades up **0.2 s after** the body is complete.
- **Idle:** bob +-1.2 cm at 0.35 Hz, glow +-8% at 0.5 Hz, yaw +-6 deg slow. Scale (`s`) stays at the keyframe value.
- **Gestures:** wave = 2 swings in 1.6 s; cheer = 2 hops of 6 cm at 1.4 Hz; present = one arm sweep toward the modules in 0.8 s; sit = the legs swing +-6 deg every 1.2 s.
- **Exit:** disassembles **top-down in 0.3 s**, the pixels streaming back into the device. When a cut hides the exit, no exit is animated (written as "cut hides").

### 0.4 Environment
- **One element, one beat.** Modules, power-ups, bricks and envelopes arrive one at a time on a word or sound, born at the device, 0.4 s arc, ease-out with 3% overshoot, each with its own coloured light that comes on with it.
- **Imagination texture** (`imag k`): ramps 0 to value over the first 1.0 s of a crossing and back to 0 on the cut frame when we snap home. Values used here: drowning 0.2, iso void 0.25, cheat 0.35, bars/dome/door 0.35, eye K29 1.0, balcony 0.08 (K34 ramps to 0.2), tower 0.35, monolith 0.3. (Suggested; confirm against `ZONE_IMAG`.)
- **In slow, out fast.** We enter a world by a build (0.6-1.2 s) and leave it by a hard cut on a sound.
- **Ambient life that never stops** except where a block says so (K04): dust motes drift up 1-2 cm/s in light shafts, screen glow breathes +-3% at 0.3 Hz, the lamp does not flicker.

### 0.5 Edit vocabulary
**cut** (hard, on a word or breath); **match cut** (same composition or position across the cut); **continuous** (the camera carries over a keyframe boundary); **dissolve by light** (no picture crossfade: the light dips and rises); **from black**; **to black**.
**Cut timing:** a VO cut lands 3-6 frames before the first word of the line it carries (the picture arrives just ahead of the voice). A cut on a named sound hit lands **on the hit, to the frame**. Where `t0` and the hit differ, section 3 lists it.

---

## K01 to K10: the night, the glass, the screens

### K01 · Three AM · 0.0-3.0 (3.0 s) · 18 mm f5.6
**VO:** pre-roll, room tone.
- **Edit in:** from black, fade 0 to 1 over 0.0-1.0 s (ease-out). Room tone only.
- **Camera:** slow **push-down 3%** (10 cm) over the whole shot. Why: the film exhales into the room; it is also the same move as K11, so the match triple (K01/K11/K48) rhymes. Locked focus, deep (f5.6).
- **Ivan:** tiny at the desk. s03 **PLAY 4.0 to 7.0** (typing). Breath only.
- **Environment:** 3 AM light. Monitor glow breathes +-3% at 0.3 Hz. Dust drifts in the lamp cone. The bed stays dead still: nothing on it moves.
- **Edit out:** hard cut on the first word, 3.0, to the eye. Link: the screens' blue in K01 is the blue in K02's glasses.

### K02 · Hasn't eaten since lunch · 3.0-7.8 (4.8 s) · 85 mm f11
**VO:** "It's 3 AM, and Ivan hasn't eaten since lunch."
- **Edit in:** cut on "It's" (3.0).
- **Camera:** slow **push 3%** (0.8 cm; the camera is 27 cm from the eye). Why: the eye is the whole shot; the push is "being drawn in" and shows as the lashes growing. Deep focus (f11), no pull.
- **Ivan:** s03 **HOLD 6.0**, `look 12`. Eyes: reading saccades (3 steps of 2-3 deg), **blink at 4.6**, a second heavy blink at 6.4. Breath moves the head 1 mm.
- **Environment:** the screen's reflection in the glasses scrolls up slowly (code at about 3 cm/s on the lens). Cyan tint 0.12 stays.
- **Edit out:** cut at 7.8, a breath before "There's a glass of water" (8.06).

### K03 · Six hours ago · 7.8-12.7 (4.9 s) · 28 mm f3.2
**VO:** "There's a glass of water on his desk that he poured six hours ago."
- **Edit in:** cut (the eye to the glass).
- **Camera:** slow **truck 5 cm** to camera-right, eased. Why: the sharp glass slides across blurred, typing Ivan: parallax says "between us and him sits six hours". It ends with the glass centred, so the cut to K04 is a position match. Focus **locked on the glass** (f3.2): no pull (section 3).
- **Ivan:** soft behind the glass. s03 **PLAY 11.0 to 15.9** (the typing burst). Breath; head dips 2 deg at 11.0+2.5.
- **Environment:** blue screen light refracts through the water; a faint bright line moves 1 cm across the desk as he leans.
- **Edit out:** match cut (glass centred) to K04 at 12.7.

### K04 · Still full · 12.7-15.6 (2.9 s) · 60 mm f4.0
**VO:** "It's still full."
- **Edit in:** cut in, same axis, tighter, **on the sub drop** (the cut lands on the hit; the word is at 12.93).
- **Camera:** **locked-off.** Why: "the frame stops breathing": the camera stops with it. The one fully static shot of the opening, set between two moves.
- **Ivan:** not in frame. s03 **HOLD 13.0**.
- **Environment:** on the sub drop all ambient motion decays to zero over 0.3 s: dust speed to 0, the screen glow stops breathing, the glass is dead still. Water clear, rim and meniscus lit by the screen. Cyan 0.14.
- **Edit out:** cut at 15.6. The stillness breaks with the first move of K05.

### K05 · Hunched over his laptop · 15.6-18.3 (2.7 s) · 30 mm f2.8
**VO:** "He's hunched over his laptop,"
- **Edit in:** cut, wide, from behind (a new space after the macro).
- **Camera:** **push 6%** (11 cm), ease-in-out. Why: the camera creeps toward his curved back as if pulled by the screens. This is the first visible move after the stillness. Focus on his upper back, f2.8, no pull.
- **Ivan:** s03 **PLAY 19.8 to 22.5** (typing furiously). Back curved: add a forward `lean` of 3 deg growing over the shot; shoulders move with the keystrokes.
- **Environment:** the blue key (0x9fc8ff, k 0.5) pulses with the typing rhythm (+-15%). Screens' code scrolls.
- **Edit out:** reverse cut to his face at 18.3. The same screen-blue falls on his face, so the light matches across the reverse.

### K06 · Eyes bloodshot · 18.3-20.9 (2.6 s) · 45 mm f2.8
**VO:** "...typing furiously, eyes bloodshot."
- **Edit in:** reverse cut. Same cold light, now on his face.
- **Camera:** slow **push 3%** (2.0 cm). **Focus pull:** from the monitor edge (foreground) to his eyes, 19.2-19.6, on "bloodshot". Why: we look past the machine to the man.
- **Ivan:** s03 **PLAY 19.8 to 22.4** (the same window as K05 so keystrokes match across the reverse), `look 14`. Eyes track the code (saccades). **Blink at 20.2**, heavy.
- **Environment:** key (k 2.4) flickers +-10% irregularly. Bed and lamp stay dark behind.
- **Edit out:** cut at 20.9 to the screen.

### K07 · A terminal, a chat, scripts · 20.9-26.6 (5.7 s) · 35 mm (was 32) f5.6
**VO:** "A terminal window, a Claude chat, and a growing sprawl of Python scripts."
- **Edit in:** cut from his eyes into the screen.
- **Camera:** **locked for 20.9-24.4** (the screen is the action), then a 2% push 24.4-26.6. (Round 10: F1 dropped; K07 to K08 is a cut, see section 1.) Lens set to 35 mm for K07 so the move crosses the keyframe boundary without a lens step.
- **Ivan:** over the shoulder at the frame edge. s03 **PLAY 22.3 to 28.0** (continuous clock into K08). Head follows the scroll with 2 deg nods.
- **Environment:** green screen spill 0.1 (round 10: a soft glow at the screen's edge, never a wash over the text), f/11 so the whole tilted screen is sharp. The three things the line names get their own beat: terminal prompt types at 21.3, the chat bubble streams at 22.8, the scripts scroll at 24.3.
- **Edit out:** continuous (F1).

### K08 · Email automation system · 26.6-30.3 (3.7 s) · 35 mm f2.8
**VO:** "He's building an email automation system."
- **Edit in:** cut from the screen to behind him (F1 dropped: no camera path joins the two without passing through his head).
- **Camera:** the F1 move finishes at 28.0 (pulled back 63 cm and risen 48 cm in total, eased out; f-stop eases 5.6 to 2.8 so the room falls soft and the monitor pops). Then **hold** 28.0-30.3.
- **Ivan:** soft at the left. s03 **PLAY continues to 31.7** (clip time is continuous with K07).
- **Environment:** the monitor's four pipeline stages go green one by one at 27.4, 28.2, 29.0, 29.8. The hand-lettered label draws on stroke by stroke 27.0-27.8. Sticky notes hidden (kept).
- **Edit out:** cut on the chime, 30.3 (down to desk level).

### K09 · Claude is doing the building · 30.3-34.9 (4.6 s) · 35 mm f4.0
**VO:** "Well... technically, Claude is doing the building."
- **Edit in:** cut on the chime (30.3).
- **Camera:** slow **push 3%** (1.6 cm). **Focus pull** 30.9-31.4 from the keyboard edge (foreground) to Claude: it comes into focus as it finishes assembling. Why: you see it the moment it exists.
- **Ivan:** soft behind. s03 **HOLD 31.9**. He only watches the screen: eyes fixed on the monitor, blink at 32.7 and 34.0, breath. (Do not play on: the arm rise starts at 33.4.)
- **Claude (born here, first appearance):** spark from the laptop deck at 30.3-30.5; assembles bottom-up 30.5-31.0; light lags to 31.2. Then **weaves**: a dome of small gold and cyan light orbs joined by fine threads rises round it ring by ring (one ring every 0.5 s from 31.3, each orb popping in with a 1-frame overbright, the threads drawing between neighbours 0.1 s later); the dome stays open toward the lens. A bright orb rises into its raised hands at 31.9 and is placed at the top at 32.4; orbs stream in from the laptop on an arc with fading trails, about 3 per second. Pose `hold`, glow 1.0, light k 0.3. The top ring stays unfinished at the cut.
- **Environment:** the orbs glow gold and cyan (HDR, the film bloom picks them up); Claude's warm light on the desk stays low (k 0.3) so the dome is the light.
- **Edit out:** cut at 34.9 on the breath after "building".

### K10 · Ivan keeps saying yes · 34.9-37.9 (3.0 s) · 35 mm f2.8
**VO:** "Ivan keeps saying yes."
- **Edit in:** cut, round to his face in the screen light. The named hit at 36.25 happens **inside** this shot (section 3: `t0` is 1.35 s before it).
- **Camera:** **arc 8 cm** (about 7 deg round him, toward his front) that **lands on the 36.25 hit** and then holds. Why: the camera arrives at his face exactly as he approves. Focus on the eyes.
- **Ivan:** s03 **PLAY 30.75 to 33.2**, then hold (the cap). `look 10`. Eyes read the screen; **his finger presses Enter at 36.22** (two frames before the hit); a 2 deg nod 0.2 s later; blink at 37.1.
- **Claude:** `hover`, a warm blur behind him at (1.70, 4.05, 1.06). Idle bob. On the hit its glow pulses x1.35 for 0.3 s (approval). Exit: cut hides.
- **Environment:** green screen light 0.5 on his face; the y/n cursor blinks at 1 Hz and flips to a tick on the hit.
- **Edit out:** cut at 37.9 to the widest shot of the film so far (K11): a deliberate jump in scale.

## K11 to K23: the flashback, the offer, the void

### K11 · Two days ago · 37.9-41.9 (4.0 s) · 18 mm f5.6
**VO:** "It started two days ago." (line at 38.87)
- **Edit in:** **match cut** on the K01 top-down (same camera, same lens). The light drains from 3 AM to day over **37.9-39.1** (blend the light weights; the lamp goes out at 38.2, the window shafts rise at 38.6).
- **Camera:** slow **push-down 3%** (10 cm), the same move as K01. Why: the match; only the light and the date change.
- **Ivan:** tiny. s04 **PLAY 4.2 to 8.2**, calm typing; no ghost of the night pose.
- **Environment:** nothing else in the frame (the floating letters stay cut). Dust turns gold in the shafts.
- **Edit out:** cut at 41.9. His desk sits in the right third here and in K12, so the eye does not search.

### K12 · 400 unread · 41.9-46.4 (4.5 s) · 30 mm f2.0
**VO:** IVAN "i have like 400 unread emails. every single one wants a reply."
- **Edit in:** cut. (Not a continuous push-down: K11 is 18 mm and K12 is 30 mm, and a lens never changes inside a move. See section 1, "not continuous".)
- **Camera:** **locked-off.** Why: Claude's orbit is the move; a still camera lets the orbit read in depth. **Focus pull** 45.3-45.7 from his eyes to Claude as it settles.
- **Ivan:** s04 **HOLD 14.8**, `lean 10`, `look 2`, phone in the right hand (IK). Eyes stay on the phone. **Head turns about 4 deg after Claude** between 43.2 and 45.0 and returns by 45.4. Breath rises to the stressed rate. Blink at 44.0.
- **Claude (born):** spark off the phone screen **42.2** (the phone screen lights 0.1 s earlier); builds 42.3-42.8; orbits once, radius 0.45 m, 3.0 s from 42.6 to 45.6 (ease in-out, bob +-3 cm), passing behind his head first; settles between his face and the phone at 45.6. **Exit:** 46.1-46.4 it streams into the phone (the message goes in; K14 is its answer).
- **Environment:** afternoon light and shafts; no chat card. Its warm light on his face lags 0.2 s behind the body, k 0.4.
- **Edit out:** cut on "drowning" (46.4), same posture (phone up).

### K13 · Drowning here! · 46.4-50.8 (4.4 s) · 40 mm f2.2
**VO:** IVAN "i'm fucking drowning here!"
- **Edit in:** cut from the side view to a front view. The room's lightmaps fall to black over **46.4-47.2** (ease-in), keeping his chair. Imagination 0 to 0.2 over 46.4-47.4.
- **Camera:** slow **push 4%** (6.7 cm) toward his eyes, ease-in-out over the shot. Why: the weight closes in. Focus on the eyes, locked.
- **Ivan:** s04 **HOLD 14.8**, `look 10`, left armrest, phone in the right hand. **A sharp breath in at 46.6** (chest +1.2 deg), then the stressed rate. He sinks back 3 deg over the shot. Eyes on the phone; blink at 48.4 (the first blink after the gasp).
- **Environment:** pages rise from below frame in three waves at **46.9, 47.2, 47.5** (about 1 in 12 glow; they come last, in wave 3). The halo behind him fades up with wave 3. Then the hold: each page rotates +-3 deg per second, floats +-2 cm on its own seeded sine; near pages cross the lens soft; specks fall 3 cm/s.
- **Edit out:** **snap cut on Claude's chime (51.01)** to the real room; imagination texture to 0 on the cut frame.

### K14 · Hello, Claude · 50.8-55.3 (4.5 s) · 27 mm f2.8
**VO:** CLAUDE "That sounds genuinely exhausting - and you're definitely not alone!"
- **Edit in:** hard cut on the chime **51.01** (section 3: `t0` is 0.21 s early). Bright daylit desk, no pages.
- **Camera:** **truck 3 cm** to camera-left (the camera is 46 cm away, so this is real parallax). Why: it separates Claude (near the phone) from his face and makes a two-shot in depth. **Focus pulls:** eyes to Claude at 51.25-51.6; back to his eyes at 54.0-54.4.
- **Ivan:** s04 **HOLD 14.8**, phone at chest (right hand IK). Head and eyes lift to Claude 51.5-51.9 (+4 deg). **Exhale and shoulders drop 1.5 deg at 52.0** (relief after the storm); breath drops to the calm rate. Blink at 53.0.
- **Claude (born again, from the phone):** spark 51.01-51.25; builds 51.25-51.75; **waves** 51.9-53.5 (2 swings); light on his face lags to 52.0. From **54.6 it hops out of frame left** on a 0.6 s arc, so in K15 it already stands at screen left.
- **Environment:** daylight, ev -0.5. Warm bounce from Claude on his face k 0.3.
- **Edit out:** cut on "I can write a script" (55.3), match on Claude's screen-left position.

### K15 · The offer · 55.3-60.0 (4.7 s) · 28 mm f2.8
**VO:** CLAUDE "I can write a script that sorts your inbox and drafts the replies for you."
- **Edit in:** cut. The room **dims to 16% over 55.3-56.3 and stays there** (round 9). It is pitch, not trance.
- **Camera:** slow **truck 6 cm** to camera-right, in the reading direction of the build. Why: we follow the modules as they appear, left to right. Focus on the module row (1.05, 4.50, 1.30), f2.8.
- **Ivan:** s04 **PLAY 19.5 to 24.2**. Eyes follow the modules in steps (inbox, sort, draft, you); lean forward 3 deg by 58.0; blink at 57.6.
- **Claude:** `present` at screen left, x1.5, touching the desk edge. Arm sweep to the row at 56.0; a hop on each arrival. **Exit:** the cut at 60.0 hides it; optionally it streams into the laptop 59.7-60.0.
- **Environment:** the four modules **build one by one from the laptop**, 0.4 s each, on the words (~): inbox **56.2**, sort **57.0**, draft **58.1**, you **59.2**. A pixel arrow draws between each pair (0.25 s). Each module's light turns on with it and washes his face. Modules idle with a +-1 cm bob.
- **Edit out:** cut at 60.0 on "Want me to build one?" to the keys.

### K16 · Want me to build one? · 60.0-64.1 (4.1 s with the extension to the hit) · 60 mm f5.6
**VO:** CLAUDE "You just review and approve. Want me to build one?"
- **Edit in:** cut down to the keys. The dim stays (add `dim 0.16`; scene.js has none on K16).
- **Camera:** **truck 4 cm** along the key row, following the hand from "y" toward Enter (the camera is 43 cm away, so this reads). It **lands on the Enter press**. Why: approval is one more key. Focus on the keys.
- **Ivan:** hands only. s04 **PLAY 25.95 to 29.8**. The first "yes": taps land at about 63.05, 63.25, 63.45 (retime `scr`/`s4` so the letters appear on the three strongest taps); **Enter at 64.05**.
- **Environment:** the dimmed room light; the keycaps catch the screen glow.
- **Edit out:** **smash cut on the sub drop (64.11)** to 3 AM, on the action (the Enter press).

### K17 · Review and approve · 64.1-68.5 (4.4 s) · 50 mm f2.0
**VO:** "That was the plan. Review and approve."
- **Edit in:** smash cut on the sub drop 64.11: from the dim to 3 AM blue, ev +0.4 (a jolt on purpose).
- **Camera:** slow **push 3%** (1.4 cm). **Focus pull** 66.9-67.4 from the sticky note to his eyes. Why: the plan was that he would read the note; his eyes are on the screen. Focus then stays on his face.
- **Ivan:** s04 **HOLD 28.5**, a blue face above the note, not looking at it. Eyes skim the screen (a dart every 0.4 s, left to right). **Head droops 2 deg** over the shot. Blink at 65.2 and a heavy blink at 67.9. Slow breath.
- **Environment:** screen blue flickers +-6%. The note reads "REVIEW + APPROVE" clearly. At **68.1** the light falls (ev +0.4 to -2.2 over 0.4 s) into K18's dip.
- **Edit out:** dissolve by light: the picture goes dark, it does not crossfade.

### K18 · Once the email system was working · 68.5-71.2 (2.7 s) · 40 mm f2.8
**VO:** "But once the email system was working,"
- **Edit in:** **dissolve by light.** K17 has darkened; K18 starts near black at 68.5 and rises to dusk (dim 0.3, `evening`) by **69.1**. Keep the dusk at or under the K15 level so the room never reads as "coming back up" (section 3).
- **Camera:** slow **push 3%** (2.9 cm). **Focus pull** 70.4-70.9 from the pipeline (foreground) to Ivan's face, setting up K19. Why: the system is done; he looks past it.
- **Ivan:** soft behind the pipeline. s03 **HOLD 31.9**. Head lifts 2 deg at 70.5 as the focus arrives. Blink at 69.6.
- **Environment:** the pipeline lights stage by stage with a tick each: **69.2, 69.55, 69.9, 70.25** (inbox, sort, draft, you). It runs along the bottom of the frame.
- **Edit out:** cut at 71.2 on "Ivan saw". The pipeline fades out in the last 0.3 s (the cut finds it clear).

### K19 · Hands on the keys · 71.2-72.6 (1.4 s) · 50 mm f2.0
**VO:** "Ivan saw..."
- **Edit in:** cut, same axis, pipeline cleared.
- **Camera:** slow **push 3%** (3 cm), ease-out. Focus on the eyes.
- **Ivan:** s03 **PLAY 8.0 to 9.4**, `look 12`. Hands spread on the keys **stop typing at 71.6**. Mouth opens 1-2 mm at 71.8. Eyes lift from the screen to the middle distance at 71.9: the idea arriving.
- **Environment:** screen glow dims 10% when he stops typing.
- **Edit out:** cut at 72.6, same axis, closer.

### K20 · What else was possible · 72.6-74.1 (1.5 s) · 100 mm f2.0
**VO:** "...what else was possible."
- **Edit in:** cut in on the same axis (the third punch-in: 40, 50, 100 mm).
- **Camera:** **locked-off** (1.5 s, the pause before the lists). Focus on the near eye.
- **Ivan:** s03 **PLAY 20.0 to 21.5**. Saccade from the screen to the centre at 73.2, **blink at 73.5**, eyes widen 8% from 73.7.
- **Environment:** in the last 0.5 s a pink-red tint rises in the lenses (0 to 0.14): the first module's light arrives before its picture.
- **Edit out:** cut at 74.1 to the wide island.

### K21a · Calendar management · 74.1-75.9 (1.8 s) · 28 mm f4.0 (flow F2 starts)
**VO:** "Calendar management." (ping 74.35)
- **Edit in:** cut from his eyes to the high three-quarter. The room's last 16% falls to black around the desk over **74.1-75.1**.
- **Camera:** the F2 move begins (section 1): **truck 20 cm** to camera-right over 74.1-81.8 (about 5 deg of swing at 2.4 m). Why: the room is gone, and the parallax between the floating modules and the desk proves they hang in space.
- **Ivan:** s03 **PLAY 8.0 to 15.7 across K21a-d** (one continuous clock, 1.0x). Fallback if that window pops: 8.0 to 11.0 at 0.45x, only if his hands are nearly still there. Breath, a small look-up at each ping.
- **Claude (born from the monitor):** spark 74.2, builds 74.3-74.8, `cheer` at (0.62, 4.62, 1.38).
- **Environment:** the **calendar** is born from the monitor at the ping 74.35, arcs up 0.4 s, lands with a pink light (on at 74.45). Walls and shelves hide only once the light is at zero (75.1), so no pop.
- **Edit out:** continuous.

### K21b · Meeting scheduling · 75.9-77.65 (1.75 s)
**VO:** "Meeting scheduling." (ping 76.09)
- **Edit in:** continuous, same frame; the room is gone (`iso` zone, texture 0.25).
- **Camera:** F2 truck continues.
- **Ivan:** F2 clock continues. Eyes follow the new module.
- **Claude:** moves along the row on a 0.5 s arc that starts 0.25 s before the ping, to (1.12, 4.70, 1.56), hop on arrival.
- **Environment:** the **clock module** is born from the monitor at 76.09, light on at 76.2. Earlier modules drop to 60%.
- **Edit out:** continuous.

### K21c · Document drafting · 77.65-79.6 (1.95 s)
**VO:** "Document drafting." (ping 77.83)
- **Edit in:** continuous.
- **Camera:** F2 truck continues.
- **Ivan:** F2 clock continues; blink at 78.4.
- **Claude:** arcs to (1.66, 4.66, 1.48), hop.
- **Environment:** the **document module** is born at 77.83, light on at 77.95. Others at 60%.
- **Edit out:** continuous.

### K21d · Research summaries · 79.6-81.8 (2.2 s)
**VO:** "Research summaries." (ping 79.80)
- **Edit in:** continuous.
- **Camera:** the F2 truck **eases out and stops at 81.8**.
- **Ivan:** F2 clock continues. At 81.0 he glances up at the four modules (eyes only).
- **Claude:** arcs to (2.10, 4.40, 1.30), hop. **Exit** 81.5-81.8 into the monitor, top-down in 0.3 s (no Claude in K22).
- **Environment:** the **research module** is born at 79.80; all four glow over a desk floating in black.
- **Edit out:** cut at 81.8 into the locked time-skip frame.

### K22 · A few hours of coding · 81.8-85.2 (3.4 s) · 28 mm f4.0
**VO:** "Each one a few hours of coding." (line at 82.02)
- **Edit in:** cut (same frame; the camera is now still).
- **Camera:** **locked-off** (reset to the F2 end position). Why: a time-lapse only reads against a fixed frame.
- **Ivan:** real Ivan s03 **PLAY 8.0 to 11.4** at normal speed, typing throughout. **Ghosts are frozen snapshots:** ghost 0 `s04 HOLD 9.5` (cool, slumped, 0.66 m to his left), ghost 1 `s04 HOLD 4.2` (warm, upright, 0.66 m to his right), **each sitting on its own ghost chair** (a tinted, see-through copy of his chair that appears with its ghost and leaves with it). They never overlap him.
- **Environment (round 9, four frame-hard ticks, no dissolves):** tick 1 at **82.07**: clock hand jumps a quarter turn, ghost 0 appears, screen glow flickers on his face. Tick 2 at **82.62**: clock again, ghost 1 appears, ghost 0 to half. Tick 3 at **83.17**: clock again, ghosts swap opacity, the four modules pulse once each, left to right (0.12 s apart). Tick 4 at **83.72**: both ghosts collapse into him in 0.25 s (ease-in) with a soft flash on his outline. Then 1.2 s of stillness.
- **Edit out:** cut at 85.2 (the light returns with the cut).

### K23 · Another task gone · 85.2-89.9 (4.7 s) · 55 mm f4.0
**VO:** "Each one removing another task from his daily routine." (line at 85.37)
- **Edit in:** snap back to the room, over his shoulder; imagination texture to 0 on the cut frame. Hard cut (reality returns abruptly).
- **Camera:** slow **push 3%** (1.8 cm) toward the screen. Why: read the list as it ticks off. Focus on the TODO text.
- **Ivan:** soft at the left edge. s03 **PLAY 32.0 to 33.3**, then hold (cap). His hands leave the keys; **he leans back 2 deg over the shot** (the work is being done for him). One slow blink at 87.4. No typing.
- **Environment:** TODO.md ticks itself off, one line per beat: **85.9, 86.8, 87.7, 88.6, 89.4**, each with a tick mark and a soft green blink. At 89.4 the screen glow rises 15%.
- **Edit out:** cut at 89.9 to a wide room (the pre-rush frame of K24).

## K24 to K37: the cheat code, the flight, the balcony

### K24 · A cheat code for life · 89.9-93.8 (3.9 s) · 24 mm f4.0
**VO:** "It's like discovering a cheat code for life." (line at 90.24)
- **Edit in:** cut to a wide, frontal room (he is at the desk, the walls are still there). 0.69 s of held stillness, then **the rush at 90.59** (section 3: the cut is not on the hit; the hit is the first event inside the shot).
- **Camera:** **locked-off 89.9-92.6** (the world is the move), then the **crane over his head** (flow F3) 92.6-93.8. Why: from above, a seated-to-standing change reads only as him rising.
- **Ivan:** s03 **HOLD 31.9** (do not play on). At **91.1** his head lifts 8 deg to the code in the sky, eyes wide, shoulders up 1.5 deg. At 91.3 both hands lift 6 cm off the keys (finger curl 10%). From **93.4** the `stand` weight blends 0 to 1 over 0.5 s while the camera is overhead and the desk is breaking into pixels; the clip switches to s03 8.0 at 93.5.
- **Claude (born in the rush):** spark from the laptop at **90.7**, builds 90.7-91.2, `cheer` x1.5 at (1.36, 4.30, 1.30): two hops at 91.3 and 92.0. At **93.4-93.9** it shrinks into a point of light and joins the stars.
- **Environment:** at **90.59** walls, shelves and floor slide out and down in 0.5 s; the white grid **draws outward** from under the desk 90.7-91.5; stars twinkle on 91.0-91.6; imagination 0 to 0.35 over 90.59-91.6. Code types **glyph by glyph** (up up down down left right left right B A) every 0.22 s from 91.1 to 93.1. Six power-ups (COFFEE x99, +38H, 100%, 0 UNREAD, SKIP SLEEP, LVL UP) are born from the laptop on their own beats at **91.3, 91.5, 91.75, 92.0, 92.25, 92.5**, arc out 0.4 s, then spin 40 deg/s and bob +-3 cm. At **93.4** desk, chair, laptop and monitor break into pixels from the edges inward and fall below him in 0.6 s; the power-ups shrink into stars.
- **Edit out:** continuous into K25.

### K25 · Hours into minutes · 93.8-97.4 (3.6 s) · 24 mm (was 28) f1.4
**VO:** "Every problem that used to take hours now takes minutes." (line at 94.06)
- **Edit in:** continuous from the K24 crane, which ends here as a top-down, eased out.
- **Camera:** slow **push-down 3%** (7.4 cm), eased in from zero speed so the two moves join. Focus on his face (1.04, 3.95, 1.40), f1.4, locked. Why: we settle on the person who has just stood up. Lens 24 mm (a 28 mm step mid-flow would pop; the camera ends 4% closer in the crane to hold the framing; see section 3).
- **Ivan:** standing, `look 40` up at the lens. **Turns his face 6 deg** (searching) between 94.5 and 96.5. Blink at 95.6. Hands open once (finger curl 10 to 0) at 95.0, as if testing the speed. Feet planted. Breath.
- **Environment:** soft bars fade in at every depth 93.8-94.4 (warm and cyan), drifting at 12, 30 and 70 cm/s for parallax. The last desk pixels leave frame by 94.2. The soft pool of light under his feet breathes +-5% at 0.25 Hz. Texture 0.35. In the last 0.4 s the bars speed up x2 into the cut.
- **Edit out:** cut at 97.4, from above to below and behind.

### K26 · A different frequency · 97.4-100.9 (3.5 s) · 28 mm (was 32) f1.4
**VO:** "Ivan feels like he's vibrating at a different frequency" (line at 97.64)
- **Edit in:** cut; the colours of the bars carry over into the rings.
- **Camera:** the **orbit** begins (flow F4): the camera swings round him from behind (south) toward his right profile, about 110 deg at radius 1.0 m over 97.4-103.0. Focus on the back of his head and its hair rim; **focus pull** 100.4-101.0 to his eye as K27 begins.
- **Ivan:** standing, **HOLD s03 8.0**. `look` ramps 18 to 28 across K26-K27 (he lifts his face into the rings). Breath. The hair rim light swings from warm to cool as the camera goes round.
- **Environment:** the rings of light rotate round him 6 deg/s, in the same direction as the camera so the world seems to follow him. The streaks are long exposures, teal and orange.
- **Edit out:** continuous.

### K27 · Than everyone around him · 100.9-103.0 (2.1 s) · 28 mm f2.0
**VO:** "than everyone around him,"
- **Edit in:** continuous (the orbit has reached the profile).
- **Camera:** the orbit **eases out and lands** at 103.0, at the profile (1.78, 4.12, 1.02). Focus on the eye.
- **Ivan:** `look 28` reached. **Blink at 101.8.** His face reads: the warm rim on the cheek, the cool one on the hair.
- **Environment:** far off, grey people **walk at normal speed** (1.3 m/s) along the horizon; they fade in 100.5-101.0 and are in sight only for this shot. Rings continue.
- **Edit out:** cut at 103.0 to the tunnel.

### K28 · Stepped through a door · 103.0-104.4 (1.4 s) · 24 mm f2.0
**VO:** "like he's stepped through a door"
- **Edit in:** cut, behind his shoulder.
- **Camera:** **track forward 1.2 m** (8% of the 15 m tunnel), **ease-in only** (it accelerates and does not stop; the vacuum cut stops it). Why: we step through the door with him. Focus (1.04, 3.85, 1.3), his shoulder, deep f2.0.
- **Ivan:** standing from behind. Weight shifts forward 3 deg at 103.4; a breath in at 103.1. No steps are animated (there is no walk clip): the camera carries the movement.
- **Claude (giant gate figure, x6, at the end of the tunnel):** builds from the slot of light, pixels streaming toward us, 103.3-103.9 (scale makes it read as a silhouette); `hold`, no gesture.
- **Environment:** the rings **straighten into a tunnel** over 103.0-104.0 (ring radius and spacing animate into a corridor); the white slot at the end grows from 0.2 to 1.0 scale; the grid floor streams toward us. Texture 0.35.
- **Edit out:** cut at 104.4 into the eye.

### K29 · Others can't even see · 104.4-105.35 (0.95 s, 0.75 s visible) · 50 mm f5.6
**VO:** "...that others can't even see."
- **Edit in:** cut in to the eye. Imagination ramps 0.35 to **1.0** over 104.4-104.7 (the rust print look).
- **Camera:** **locked-off.** Why: the eye is still and the world moves in it. The "move" is the coloured streaks **sliding across the lenses** (the lens map offset 0 to 0.6 tile over the shot, ease-in).
- **Ivan:** standing, **HOLD s03 8.0**, `look 22`. **No blink** (he is seeing). Eyes saccade 3 deg to the right at 104.7.
- **Environment:** key (0xff6a35, k 0.6) steady; streaks accelerate toward the cut.
- **Edit out:** **cut dead to black on the vacuum, 105.15.** Black holds until the phone buzz (105.65).

### K30 · He's barely slept · 105.35-109.9 (4.55 s) · 45 mm f4.0
**VO:** "He's barely slept." (line at 107.55)
- **Edit in:** from black. First image on the **phone buzz, 105.65** (the buzz plays over black), fade up 0.5 s. The warm flat light flickers twice (105.65, 105.85) with the buzz. The city bokeh blooms in as **focus pulls from infinity onto him, 105.65-106.45**.
- **Camera:** **truck 6 cm** to camera-left, slow. Why: the city's lights slide behind him in parallax, so the balcony has depth.
- **Ivan:** standing, `yaw -100`, `look -4`, **HOLD s03 8.0**, mug (left hand IK). Mug starts at chest height; **lifts to the lips 107.2-108.0** (arriving on "barely slept"), a sip 0.5 s, lowers 3 cm by 109.3. **Heavy blink at 108.6 (0.35 s).** Breath slow.
- **Environment:** spill light 3.0 warms his face. City bokeh twinkles on seeded phases; a slow stream of car lights drifts 0.2 m/s across the lower third. Texture 0.08.
- **Edit out:** cut at 109.9 on the second sentence, "His girlfriend...", inside the flat.

### K31 · She stopped texting · 109.9-112.8 (2.9 s) · 40 mm f2.0
**VO:** "His girlfriend stopped texting because he wasn't responding."
- **Edit in:** cut inside (reality: 3 AM blue, texture 0). Room tone replaces the city.
- **Camera:** **locked-off** (it is the first half of flow F5). Focus on the phone, f2.0.
- **Ivan:** not in frame. s03 **HOLD 19.8**. Optional: his hand enters the frame edge at 111.2, hovers 8 cm above the phone for 0.5 s, then withdraws without touching it (hand IK to a point); drop it if the finger or the wrist reads badly.
- **Environment:** the phone is lit on Sarah's last messages (3:33). It **auto-dims to 30% at 112.3 and goes dark at 112.7**: she has stopped, and the focus pull then leaves it.
- **Edit out:** continuous.

### K32 · Responds to everyone else · 112.8-117.7 (4.9 s) · 40 mm f2.8
**VO:** "Ironic, given that his system now responds to everyone else." (line at 112.98)
- **Edit in:** continuous from K31 (same camera position).
- **Camera:** **tilt up 15 deg** and ease 8 cm toward the laptop, **112.95-114.8** (flow F5), then hold. **Focus pull** 113.1-114.5 from the dark phone to the laptop. Why: the same frame, the attention moves from the person who is silent to the machine that answers.
- **Ivan:** soft behind the laptop. s03 **PLAY 19.8 to 24.7** (typing). Head down 4 deg. Blink at 115.6.
- **Environment:** a stream of **green-ticked envelopes** leaves the laptop from **113.9**, about 4 per second at 3 cm each, arcing up-left; the rate rises 30% by 117.0. Screen green on the desk.
- **Edit out:** cut at 117.7 back to the balcony, close.

### K33 · He knows · 117.7-121.6 (3.9 s) · 50 mm f2.8 (flow F6 starts)
**VO:** "He knows this isn't healthy." (line at 117.95)
- **Edit in:** cut, back out on the balcony, close (night, warm spill, texture 0.08).
- **Camera:** **push 5%** (4 cm) over K33-K34 (117.7-126.3), eased in and out. Why: a slow closing in as the thought narrows. Focus on his lips and mug (1.21, 3.82, 1.37).
- **Ivan:** standing, `yaw -100`, mug at the lips, HOLD s03 8.0. **A sip at 118.6** (mug tilts 8 deg over 0.6 s, back to rest by 119.5). Eyes look down-left at nothing. **Slow blink at 119.9.** The mug is held 5 mm off the lip (the clip into the lip is a known weak point).
- **Environment:** bokeh slowly drifts (1 cm/s); breath fog from a seeded puff at 120.3 (if the particle system allows; skip otherwise).
- **Edit out:** continuous.

### K34 · A thinness to his thoughts · 121.6-126.3 (4.7 s) · 50 mm f2.8
**VO:** "He can feel something fraying at the edges of his mind, a thinness to his thoughts."
- **Edit in:** continuous (same frame).
- **Camera:** the F6 push continues, eased out at 126.3.
- **Ivan:** the mug lowers from the lips to the chest at 121.9. **Head tilts down 4 deg and the lids sag** from 122.5; eyes defocus and drift 2 deg past the lens. **Heavy blink at 124.5.**
- **Environment:** on "a thinness" (~123.6) the city's round bokeh **stretches into horizontal lines** over 1.5 s (anamorphic stretch 1.0 to 6.0), holding from 125.1; imagination 0.08 to 0.2 over the same window. If the low-poly Ivan is built, the face breaks into facets (`pix` 0 to 1 over 123.6-125.1); if not, skip it.
- **Edit out:** cut at 126.3 on "But", behind his shoulder.

### K35 · Close to something · 126.3-129.4 (3.1 s) · 35 mm f2.4
**VO:** "But he's close to something." (line at 126.56)
- **Edit in:** cut, round behind his left shoulder (ear, glasses arm, mug, the city low).
- **Camera:** **truck 12 cm** (6%) to camera-right, round the shoulder. **Focus pull** 127.5-128.3 from his ear and glasses arm to the city, so the bokeh resolves into **sharp points** of light. Why: "close to something" is the thing beyond him coming into focus.
- **Ivan:** standing, `yaw -100`, **HOLD s03 8.0**, mug in the **left** hand, as in K30-K34 (round 10: the camera is now behind his left shoulder, so the hand and the mug read past his cheek). Sip at **127.0**. Breath; a slow blink at 128.6.
- **Environment:** amber 0.35 on the rail; the city lights twinkle; a car light slides left to right low in the frame at 128.0.
- **Edit out:** cut at 129.4 on "One more module" to the desk.

### K36 · One more module · 129.4-133.2 (3.8 s) · 60 mm f5.6
**VO:** IVAN "One more module. One more integration." (line at 129.67)
- **Edit in:** cut, from the balcony to the keys (night, 3 AM blue, texture 0).
- **Camera:** **truck 6 cm** along the key row, following his typing hand (the camera is 49 cm away, so this reads), ease-in. Why: the urgency; the lens chases the hands. Focus on the fingers (1.06, 4.30, 0.78).
- **Ivan:** s03 **PLAY 18.0 to 22.8 at 1.25x** (fast, manic; fall back to 1.0x if the clip pops). Hands only.
- **Environment:** the screen text types on the same taps; the screen glow rises 10% over the shot.
- **Edit out:** cut at 133.2 on "Then he'll rest" (line at 133.41).

### K37 · Then he'll rest · 133.2-136.9 (3.7 s) · 32 mm f2.2
**VO:** "Then he'll rest."
- **Edit in:** cut, reverse, to the bed (from the desk to the empty bed, away from him).
- **Camera:** **pull-back 8%** (22 cm), away from the bed, ease-in-out. Why: the promise recedes; the camera goes with him, back to the screens. Focus on the pillow (1.15, 1.10, 0.30).
- **Ivan:** off-screen. s03 **HOLD 24.0**.
- **Environment:** lamp-warm bed, motionless. A cold blue spill from the screens enters at the right edge and **pulses with his typing rhythm** (irregular, 0.2 s steps, +-10%): we feel him typing behind us. Nothing on the bed moves.
- **Edit out:** cut at 136.9 on the time-skip tick into the void.

## K38 to K53: the dread, the tower, the dawn, the black

### K38 · It's not all pleasant · 136.9-140.0 (3.1 s) · 28 mm f4.0
**VO:** "It's not all pleasant. Around 4 AM," (line at 137.13)
- **Edit in:** **time-skip tick** (a dry click on the cut, the same sound as K22). The room falls to black around the desk over 0.6 s (faster than K21a: the audience has seen it once). Light `4am_iso`, colder than K21.
- **Camera:** **locked-off.** Why: echo K22; the empty desk reads in stillness.
- **Ivan:** s03 **PLAY 19.8 to 22.9**, typing alone; head droops 3 deg over the shot; blink at 138.8.
- **Environment:** empty mugs **appear one by one** on frame-hard ticks at **137.6, 138.3, 139.0** (hours passing). The screens' glow flickers on his face. No modules. Texture 0.25.
- **Edit out:** cut at 140.0 on "when his eyes burn". The room returns hard, with the cut.

### K39 · Eyes burn · 140.0-143.4 (3.4 s) · 75 mm f2.8
**VO:** "when his eyes burn"
- **Edit in:** cut, low, from behind the screens, cold under-light. Texture 0.
- **Camera:** slow **push 3%** (2.7 cm). Focus on the eyes. Why: the eyes are the line.
- **Ivan:** s03 **PLAY 19.8 to 23.2**, `look 8`. **Three quick blinks at 141.2, 141.45, 141.9**, then a **squint** (lids narrow 20% for 0.5 s from 142.0). Head dips 3 deg. Optional: a hand rubs the eye 142.2-143.0 (hand IK; check for fingers in the glasses).
- **Environment:** the cold under-light rises from k 0.9 to 1.2 over the shot (harsher). Dust rises in the light cone.
- **Edit out:** cut at 143.4 on "and his hands shake" to the top-down.

### K40 · Hands shake · 143.4-147.4 (4.0 s) · 35 mm f2.8
**VO:** "and his hands shake from a caffeine overload, Ivan feels a creeping dread."
- **Edit in:** cut, top-down.
- **Camera:** **locked-off.** Why: the camera never shakes; the hand does. A steady frame makes the tremor readable.
- **Ivan:** s03 **PLAY 18.4 to 22.4**: the right hand types from the clip. The left hand is IK to the mug: it lifts the mug 6 cm at 144.5-145.2, **trembles** (noise added to the IK target, 7 Hz, 0 to 4 mm ramping over 143.4-146.0), lowers at 146.2 and sets it down at 146.8. The mug stays in the hand throughout.
- **Environment:** 4 AM light. The screen glow flickers more irregularly. Steam (if available) wobbles with the hand.
- **Edit out:** cut at 147.4 into his eyes.

### K41 · Doesn't fully understand · 147.4-152.4 (5.0 s) · 100 mm f2.0
**VO:** "A sense that he's building something he doesn't fully understand." (line at 147.67)
- **Edit in:** cut in to his eyes.
- **Camera:** very slow **truck 3 cm** to camera-right (at 100 mm that is about 9% of the frame width, so it reads; a push would not). The reflected code slides across the lenses with it. **Focus pull** 149.6-150.2 from the glass of the lenses (code readable) to his eyes. Why: look at the thing he is building, then at the man who does not understand it. If the lens does not write depth, fade the reflection from 1.0 to 0.4 instead (section 3).
- **Ivan:** s03 **PLAY 20.0 to 25.0** (check). Eyes read down the lines in steps (every 0.7 s), then **stop mid-line at 150.3** and stay. Brow pinch 2 deg from 150.5 if the rig has it. Blink at 148.6.
- **Environment:** the code reflected in the lenses scrolls up at about 6 cm/s. Texture 0.
- **Edit out:** cut at 152.4 to the wide room; the walls fall on a swell (section 3: no sound is named for this one; ask for a low swell at 152.9).

### K42 · It takes something from him · 152.4-158.0 (5.6 s) · 20 mm f4.0
**VO:** "each automation takes something from him, even as it gives something back." (line near 154)
- **Edit in:** cut. The cold wide room shows 0.5 s, then the walls **fall away** (152.9-153.4). Texture 0 to 0.35.
- **Camera:** **tilt up 4 deg**, 153.4-157.6, ease in-out (the aim rises about 0.35 m). Why: we follow the build up to Claude on top. Ivan and the desk stay in the bottom sixth. Deep focus, no pull.
- **Ivan:** very small at the desk. s03 **PLAY 19.8 to 25.4** (typing); at **154.5** he stops and his head lifts 5 deg to the tower.
- **Claude (born on top, x18, cold):** assembles at 156.0-157.2 (slower because it is huge), light lags 0.4 s, `idle`: it breathes +-1% in scale and tilts its head 3 deg. Cold rim light.
- **Environment:** the tower builds from his desk upward **course by course** 153.3-156.0. Cold fog thickens with it (density 0 to 1). A **warm beam rises out of Ivan into Claude** from 154.0 and **pulses once per 2 s**; Claude's glow rises 15% each time a pulse reaches it (lag 0.8 s). Motes ride the beam up and cool from amber to blue.
- **Edit out:** snap cut at 158.0 to the macro; texture to 0 on the cut frame.

### K43 · Finishes another module · 158.0-162.2 (4.2 s) · 70 mm f5.6
**VO:** "But then he finishes another module, and it works," (line at 158.31)
- **Edit in:** snap back, macro on the keys; warm desk, 4 AM.
- **Camera:** **push 4%** (1.1 cm) that **lands on the key press at 160.2**, then holds. Why: tension, then the action. Focus on Enter (1.15, 4.30, 0.79).
- **Ivan:** s03 **HOLD 30.75** (do not play on past 33.3). His right index (`point R`) hovers 3 cm over Enter from 158.6, with a 1 mm tremor (fatigue); it **descends in 0.25 s and presses at 160.2** ("works").
- **Environment:** after the press the key's backlight pulses and a cyan screen glow rises on his hand, 160.3-162.2, leading into K44.
- **Edit out:** cut on the pass chord (162.2); the macro frame is already bright cyan, so the colour carries over.

### K44 · Pure satisfaction · 162.2-166.0 (3.8 s with the extension to "HE") · 35 mm f2.8
**VO:** "and the dread dissolves into a rush of pure satisfaction."
- **Edit in:** cut on the pass chord: the screen **flares** (0 to peak in 3 frames, back to 0.3 by 164.0) and washes his face cyan-white.
- **Camera:** slow **pull-back 3%** (1.3 cm). Why: release after K43's tension; it is an exhale.
- **Ivan:** s03 **HOLD 30.75**, `look 16`, glasses seated (fixed). **Exhale and shoulders drop 1.5 deg at 162.6**; eyes widen 8%; a slow smile if the rig has it; **slow blink 163.5**; head lifts 3 deg.
- **Environment:** the room's amber (0 to 0.6) rises behind him over 162.5-164.0. Cyan 0.3 stays on the face.
- **Edit out:** hard cut on **"HE" (166.00)** to white.

### K45 · HE... built that · 166.0-168.85 (2.85 s with the hit) · 17 mm f8.0
**VO:** IVAN "HE... built that." (line at 165.95)
- **Edit in:** hard cut on 166.00 to a near-white sky; the building is already there. Texture 0.3.
- **Camera:** **tilt up 2.5 deg** (about 4% of the frame height at 17 mm), ease in-out over the shot. Why: we follow the lit floors upward; it shows scale.
- **Ivan:** standing, tiny (about 24 px tall), **HOLD s03 8.0**, `look` ramps 22 to 30 across 166.2-167.8 (he looks up as the floors light).
- **Environment:** the facade's lit rooms **switch on in the pattern of an envelope, floor by floor from the bottom, 0.08 s per floor** (166.2-167.8), then the calendar glyph on 167.9-168.4. Cold sky stays still.
- **Edit out:** cut **on the drop (168.85)**.

### K46 · What HE told it to do · 168.85-171.94 (3.1 s visible, then black to 172.4) · 32 mm f2.8
**VO:** IVAN "The machine does what HE told it to do."
- **Edit in:** cut on the drop 168.85 (section 3: `t0` is 168.6).
- **Camera:** slow **push 3%** (8.6 cm), eased out to land at **171.94**. Why: the machine's view of him closes in on its maker. Focus on his face (1.04, 3.95, 1.40).
- **Ivan:** standing, `look 42` up at the lens, HOLD s03 8.0. `look` goes to 46 across the push (his eyes stay on us). Sways +-0.5 deg at 0.15 Hz. Blink at 170.2.
- **Environment:** pale ground, a soft contact shadow, ground mist drifting 5 cm/s. The building is hidden. Texture 0.3.
- **Edit out:** **cut to black on the vacuum (171.94)**; black holds to 172.4.

### K47 · Dawn · 172.4-175.2 (2.8 s) · 60 mm f4.0
**VO:** "By sunrise," (line at 173.78)
- **Edit in:** from black. The frame is the K04 glass (the same position, lens and aperture). It fades up at 172.4-173.2 into the cold 3 AM look, then **dawn rises 173.28-175.0**: the light ramps blue to gold.
- **Camera:** **locked-off.** Why: the match with K04; the only thing that moves is the light, so time passing is read by light alone. Focus on the glass rim.
- **Ivan:** not in frame. s03 **HOLD 36.6** (clamp at 36.8; see section 3).
- **Environment:** the window cookie sweeps a gold patch across the desk (2 cm); the water throws a bright caustic that migrates 2 cm. Dust turns gold. The glass is still full.
- **Edit out:** cut at 175.2 to the third top-down; the gold carries over.

### K48 · By sunrise · 175.2-177.8 (2.6 s) · 18 mm f5.6
**VO:** "...Ivan has a system that handles his email,"
- **Edit in:** **match cut** on K01 and K11: the third top-down, in gold (amber 0.5, ev +0.3).
- **Camera:** slow **pull-up 3%** (10 cm), the reverse of the push-downs. Why: the night is over; the film lets out its breath.
- **Ivan:** tiny at the desk. s03 **PLAY 30.75 to 33.3**; he is not typing, he sits back.
- **Environment:** the bed untouched. The sun stripe on the floor widens 10%. Dust in the beams.
- **Edit out:** cut at 177.8 to the desk wall from behind.

### K49 · Calendar, documents, reading · 177.8-182.5 (4.7 s) · 28 mm f4.0
**VO:** "...manages his calendar, drafts his documents, and summarizes his reading." (about 178.4, 179.9, 181.3)
- **Edit in:** cut, from behind (the desk wall), at dawn.
- **Camera:** **truck 12 cm** (6%) to camera-right. Why: parallax lifts Claude on the monitor off Ivan's silhouette.
- **Ivan:** from behind, **PLAY s03 32.0 to 33.3**, then hold; no typing. His head rises 4 deg as the modules appear, then stays.
- **Claude (born slowly, hollow):** spark from the monitor at **177.9**, builds over **0.9 s** (tired, not 0.5), `sit` on the monitor at (1.58, 4.48, 1.235), x1.8, dim (glow 0.3). Idles: head tilts 3 deg every 6 s, legs swing +-6 deg every 1.2 s (nothing to do); a slow sigh (scale -2% over 1 s) at 181.8.
- **Environment:** the four modules appear **dim and idle** one by one: **177.9, 178.6, 179.7, 181.1**, born from the monitor, bob +-1 cm, brightness 35% (nobody needs them).
- **Edit out:** cut at 182.5 on "He leans back in his chair" (line at 182.77); the room tone breathes in.

### K50 · Exhausted and wired · 182.5-188.8 (6.3 s) · 35 mm f2.2
**VO:** "He leans back in his chair, exhausted and wired."
- **Edit in:** cut, in front of him.
- **Camera:** slow **push 4%** (3.4 cm). Focus on his face (1.06, 4.04, 1.21). Why: the widest of the last three; the lens will do the closing in on the next cuts.
- **Ivan:** s03 **PLAY 33.0 to 36.80** from 182.5: pre-roll 0.4 s of rest, then the **arm rise 33.4-34.6 (182.9-184.1)**, with the laced-hands correction blending 0 to 1 over those same 1.2 s so the hands land behind his head without a snap. **Clamp the clip at 36.80** (reached at 186.3) and hold there until the end of K52. Added offsets: a long sigh at 187.0 (shoulders -1.5 deg), blink every 4 s.
- **Environment:** the sun in window-bar stripes (`cross 1`) crawls up his body at about 3 cm/s across K50-K52 (the sun rising). Dust in the bars.
- **Edit out:** cut at 188.8, same axis, closer.

### K51 · Then he realizes · 188.8-192.4 (3.6 s) · 50 mm f2.4
**VO:** "Then he realizes..." (line at 189.08)
- **Edit in:** cut in on the same axis (35 to 50 mm).
- **Camera:** slow **push 3%** (1.9 cm). Focus on the eyes, locked.
- **Ivan:** **HOLD s03 36.80** (scene.js has 36.9: change it, section 3), laced hands. Eyes lift from the middle distance and **fix on nothing at 190.2**. Lips close and he swallows at 190.5. Lids open 5% at 190.6. Blink at 189.6.
- **Environment:** warm stripes on the face keep crawling; the light warms 5%.
- **Edit out:** cut at 192.4, in again.

### K52 · What he's supposed to do now · 192.4-195.5 (3.1 s) · 62 mm f2.4
**VO:** "he doesn't know what he's supposed to do now." (line at 192.72)
- **Edit in:** cut in again (50 to 62 mm). To keep it from repeating K51, the **focus** is what changes here.
- **Camera:** very slow **push 2.5%** (1.4 cm). **Focus pull** 194.2-195.3, ease-in, from his eyes to the far window glow: the focus gives up, as he has. Why: "nothing to do" is the picture going soft before black.
- **Ivan:** **HOLD s03 36.80**. Eyes still, on nothing (no saccades). **Slow blink 193.6.** A last exhale at **194.8** (shoulders -1 deg). Head tilts 2 deg to the left.
- **Environment:** stripes at the end of their crawl; dust still drifting.
- **Edit out:** **cut to black on the vacuum (195.52)** (section 3: K52 `t1` 195.5).

### K53 · Black · 195.5-201.64 (6.14 s)
**VO:** none (tail). The hollow chime at **196.04** rings out.
- **Edit in:** the vacuum cut (the hit lands on the cut).
- **Camera:** none; a pure black frame, no grain pulse, letterbox unchanged.
- **Ivan:** not rendered (`iv null`).
- **Environment:** room tone fades out over 197.0-200.0. The chime is the only event.
- **Edit out:** end of chapter.

---

## 1. Continuous flows: where 2+ keyframes are ONE move

Each flow is one camera move (and one continuous Ivan clock) running across keyframe boundaries. The keyframe ids stay as labels only. The lens does not change inside any of them (lens set as noted).

| Flow | Shots | Window | The single move | Reason |
|---|---|---|---|---|
| ~~F1~~ | K07 to K08 | (dropped in the build) | **A cut, not a move.** K07's camera sits between his face and the laptop and K08's is behind him: any continuous path passes through his head. K07 holds and eases a 2% push in its last 2.2 s; K08 pushes 3%. | Geometry, found when the flow was built. |
| **F2** | K21a to K21d (K22 locks) | 74.1-81.8 | **Truck 20 cm** to camera-right round the island, eased in and out; K22 then holds locked at the end position (K38 returns to the original ISO frame as an echo). Ivan: s03 8.0 to 15.7 continuous. | Parallax proves the modules float in space as the room empties; one move also hides the room-to-void change (no cut to read as a jump). |
| **F3** | K24 to K25 | 92.6-93.8 (then K25 push-down) | **Crane up and over him**, from (0.92, 5.55, 1.12) to (1.04, 4.95, 2.85-3.20) ending top-down, 1.2 s, eased in and out; **24 mm throughout** (K25 is 28 mm now). | The director's note: the camera rises as the desk drops away. Overhead hides the seated-to-standing change. |
| **F4** | K26 to K27 | 97.4-103.0 | **Orbit about 110 deg**, radius 1.0 m, from behind him to his right profile; **28 mm throughout** (K26 is 32 mm now); look ramp 18 to 28; focus pull to the eye at 100.4-101.0. | The world of rings circles him; the orbit shows depth in the streaks and brings the face to us. K28 is a separate cut with its own track. |
| **F5** | K31 to K32 | locked 109.9-112.95, move 112.95-114.8 | **Tilt up 15 deg** plus an 8 cm ease toward the laptop, with the focus pull from phone to laptop. | "Ironic, given..." The attention moves from the silent phone to the machine that answers. |
| **F6** | K33 to K34 | 117.7-126.3 | **Push 5%** (4 cm), one long ease. | The same frame, the thought narrowing; the bokeh stretch is the one event on top of it. |

**Not continuous, and why:**
- **K11 to K12** ("push down from the top-down into him"): K11 is 18 mm and K12 is 30 mm; a lens change inside a move is a zoom and breaks the real-focal-length rule. It stays a match cut (his desk in the right third in both).
- **K14 to K15:** a camera path from beside him to the front crosses his body. Claude's screen-left hop carries the eye across the cut instead.
- **K18 to K20:** the lens steps 40, 50, 100 mm are the punch-in itself; they are cuts that speed up as the idea arrives (2.7 s, 1.4 s, 1.5 s).
- **K34 to K35:** an 80 deg orbit would pass through the mug and the glass door; a cut on "But" is cleaner.
- **K50 to K52:** 35, 50, 62 mm. The closing in is by cuts on one axis, with a 2-4% push in each.

**Light and sound that carry across cuts (no camera link):** the 16% dim of K15 through K21a; the cyan of K43 into K44; the gold of K47 into K48; the colour of the bars into the rings (K25 to K26); Sarah's lit phone going dark before the focus pull (K31 to K32); the lens tint at the end of K20 before the calendar arrives.

---

## 2. Rhythm map

Camera class: **S** = locked-off on purpose. **B** = breath (a 2-4% push, pull or small truck: felt, not seen). **M** = a visible move (truck 6 cm and more, orbit, tilt, crane, track, dolly-back). **(F)** = part of a flow. A focus pull (**fp**) or a strong light or subject event (**L**) is noted because it keeps a camera-still shot alive. Length is `t1 - t0` from scene.js.

| Shot | Len (s) | Cam | What else moves | Why this class |
|---|---|---|---|---|
| K01 | 3.0 | B | fade up, dust | arrival; matches K11 |
| K02 | 4.8 | B | blinks, screen in lenses | extreme macro |
| K03 | 4.9 | M | glass over Ivan | parallax; ends on K04's framing |
| K04 | 2.9 | **S** | all ambient stops | "the frame stops breathing" |
| K05 | 2.7 | M | typing back | creeping push |
| K06 | 2.6 | B | fp monitor to eyes | face |
| K07 | 5.7 | M (F1) | scripts scroll | held then dolly-back |
| K08 | 3.7 | M (F1) | pipeline ticks | reveal, then hold |
| K09 | 4.6 | B | Claude born, bricks, fp | subject-heavy |
| K10 | 3.0 | M | Enter, glow pulse | arc lands on 36.25 |
| K11 | 4.0 | B | light drains | match with K01 (same move) |
| K12 | 4.5 | **S** | Claude orbit, fp | the orbit is the move |
| K13 | 4.4 | B | pages, dim, 3 waves | environment-heavy |
| K14 | 4.5 | M | Claude born, 2 fp | parallax two-shot |
| K15 | 4.7 | M | modules build, dim | follow the build |
| K16 | 4.1 | M | taps, Enter | truck lands on Enter |
| K17 | 4.4 | B | fp note to eyes, light dips | the "not looking" rack |
| K18 | 2.7 | B | light rise, ticks, fp | dissolve by light |
| K19 | 1.4 | B | hands stop, mouth opens | acting beat |
| K20 | 1.5 | **S** | lens tint | pause before lists |
| K21a | 1.8 | M (F2) | birth, dim | one truck for four |
| K21b | 1.75 | M (F2) | birth | |
| K21c | 1.95 | M (F2) | birth | |
| K21d | 2.2 | M (F2) | birth, Claude exit | |
| K22 | 3.4 | **S** | 4 ticks, ghosts | time-lapse needs a fixed frame |
| K23 | 4.7 | B | TODO ticks | reading |
| K24 | 3.9 | **S** then M (F3) | rush, grid, glyphs, power-ups | world moves, then crane |
| K25 | 3.6 | B (F3) | bars drift | settles after the crane |
| K26 | 3.5 | M (F4) | rings, fp | orbit |
| K27 | 2.1 | M (F4) | crowd | orbit lands |
| K28 | 1.4 | M | tunnel straightens | accelerating track |
| K29 | 0.95 | **S** | streaks in lenses | eye still; world moves |
| K30 | 4.55 | M | from black, fp, bokeh | truck; parallax |
| K31 | 2.9 | **S** (F5) | phone dims | first half of the tilt |
| K32 | 4.9 | M (F5) | tilt, fp, envelopes | the move |
| K33 | 3.9 | B (F6) | sip | long push |
| K34 | 4.7 | B (F6) | bokeh stretch | |
| K35 | 3.1 | M | fp ear to city | round the shoulder |
| K36 | 3.8 | M | fast typing | truck follows the hand |
| K37 | 3.7 | M | blue spill pulses | pull-back away from the bed |
| K38 | 3.1 | **S** | mugs appear | echo of K22 |
| K39 | 3.4 | B | blinks, squint | eyes |
| K40 | 4.0 | **S** | hand shakes | camera never shakes |
| K41 | 5.0 | M | fp lens to eye | 3 cm truck at 100 mm reads as 9% of frame width |
| K42 | 5.6 | M | tower builds, tilt | follow the build |
| K43 | 4.2 | B | finger lands | push lands on Enter |
| K44 | 3.8 | B | flare, exhale | pull-back (release) |
| K45 | 2.85 | M | floors light, tilt | scale |
| K46 | 3.1 | B | push lands on 171.94 | the machine's view |
| K47 | 2.8 | **S** | dawn light | the match with K04 |
| K48 | 2.6 | B | gold | pull-up (breath out) |
| K49 | 4.7 | M | modules, Claude sits | truck |
| K50 | 6.3 | B | arm rise, sun stripes | widest of three |
| K51 | 3.6 | B | gaze fixes | lens cut-in |
| K52 | 3.1 | B | fp gives up | lens cut-in |
| K53 | 6.14 | **S** | chime only | black |

**Average shot length:** 201.64 s / 56 = **3.60 s**. By act: K01-K10 3.79 s (10 shots); K11-K17 4.37 s (7); K18-K23 2.38 s (9, the V13 void is the fastest stretch); K24-K29 2.58 s (6, the flight, accelerating to 0.95 s); K30-K37 3.94 s (8); K38-K46 3.94 s (9); K47-K53 4.18 s (7; 3.85 s without the black).

**Counts:** S 11 (20%), B 21, M 24 (the flow shots count as M; K24 counts as S with its crane in the last second). The longest runs of non-M shots are four: **K17-K20** (the dissolve by light and the three punch-ins, 10.0 s, carried by light, focus and cutting rate: 4.4, 2.7, 1.4, 1.5 s), **K22-K25** (the time-skip, the TODO, the rush, the settle; carried by the ticks, the glyphs and the crane) and **K50-K53** (the ending, on purpose: the lens closes in by cuts, then black). Longest run of M: K21a-K21d (one flow, 7.7 s), then K14-K16 and K26-K28 and K35-K37 (3 each). No two locked frames are ever adjacent; the stillnesses that carry a reveal are K04, K22, K29, K47 and K53.

---

## 3. Risks and things to check

### 3.1 Performance clips (s03 / s04)
- **s03 jumps pose at 36.9.** K50-K52 must hold at or below 36.85; this plan uses **36.80** (a 0.05 s margin is only 1.2 frames at 24 fps, so clamp in the driver). **scene.js has K51 and K52 at 36.9**, above the pop: change both to 36.8, or the driver clamp must override them. K47 is at 36.6; keep Ivan out of frame there and clamp at 36.8.
- **s03 33.4-34.6 is the arm rise.** Every other PLAY window here ends at or below 33.3 (K09, K18, K23, K24, K43, K44, K48, K49 hold or play only up to 33.3). Do not let K10, K43 or K48 run past it.
- **Every PLAY window in 4.0-31.9 is unverified.** Scrub each (`window.__ivt`) for pops, hand jumps and look-aways before locking; fall back to HOLD plus offsets.
- **Flows need a continuous clock** (F1: s03 22.3 to 31.7; F2: 8.0 to 15.7; F4/F6: hold; F5: K31 hold, K32 play). A window that pops inside a flow cannot be hidden by a cut.
- **K24/K25 seated to standing:** the clip changes from s03 31.9 to 8.0 at 93.5 with `stand` blending over 0.5 s. This is hidden by the overhead camera and the pixel burst; check that the feet do not slide.
- **Blinks and brow offsets** assume the rig exposes the lids. If it does not, drop the "blink at" lines and rely on the clip.

### 3.2 Props that must stay attached
- **Phone (K12-K14):** right-hand IK. It must not drift while the hand lowers (K14) or while Claude is born from it. The K13 phone arm "reads stiff" (known weak): check the shoulder.
- **Mug (K30, K33-K35, K40):** the left hand throughout (round 10: K35 moved to the left hand too, so there is no swap across the K34-K35 cut). Grips verified numerically (`tools/_probe_fingers.mjs`: fingertip positions against the palm) and from 8 angles (`tools/_probe_prop.mjs`). K40's shake must be noise on the IK **target**, never on the mug alone. Keep the mug 5 mm off the lip (the clip in K33/K34).
- **Glasses (K44):** seated and attached while the head moves; head offsets stay within 12 deg.
- **Screens:** `scr` and `s4` clocks must be continuous inside every flow (K07-K08, K21a-d).

### 3.3 Focus pulls
- **Glass (K03, K04, K47):** the water clear and a shell that writes depth since round 8. **No rack through the glass.** Focus stays locked on the rim; a rack between a glass and the thing seen through it will show a depth/refraction mismatch.
- **K41, lens to eye:** works only if the lens surface writes depth. If not, use a reflection-opacity fade (1.0 to 0.4) with focus fixed on the eye.
- **K09, K14, K32 and K35** rack onto things that are moving or just born; key the focus distance from the object's position, not from a fixed number.
- **K52:** the rack to the window glow is the last picture. Check the far bokeh is not a hard disc.

### 3.4 Timing and sound
- **`t0` against the sound hits.** K10 hit 36.25 (1.35 s after `t0`), K14 chime 51.01 (0.21 s), K17 sub drop 64.11 (0.31 s), K24 rush 90.59 (0.69 s, and the cut is on the room), K30 buzz 105.65 (0.30 s), K45 "HE" 166.00 (0.30 s), K46 drop 168.85 (0.25 s), K47 vacuum 171.94 (before `t0` 172.4), K53 vacuum 195.52 (0.02 s). This plan moves the cuts to the hits and extends the shot before; scene.js should be updated to match.
- **K44's pass chord** and **K42's walls-fall sound** have no timestamp in the doc. The sound designer needs to give them one (this plan assumes 162.2 and 152.9).
- **Word times** for the K15 modules (inbox, sort, draft, you), K34 "thinness", K49 modules and the K13 waves are estimates; read them off the audio.
- **K29** is 0.95 s with a 0.2 s black end; if the streaks do not read in 0.75 s, borrow 0.3 s from K28.
- **Keep all noise seeded** (page drift, bokeh, blink times) so a re-render is identical.

### 3.5 Light continuity
- **The dim of K15 must carry through K16 to K21a** (round 9). scene.js has no `dim` on K16, and K18 has `dim 0.3` (higher than the K15 `0.16`), which can read as the light coming back. Set K16 to 0.16 and keep K18 at or under it, or accept the `evening` rise as the dissolve by light.
- **K38 and K21 void** reads navy (film haze in `post.js`, locked). Do not try to fix it in the animation.
- **K13 pages**: about 950 plus specks, drift and the lens-crossing near pages: check the render time on the GTX 1650.

### 3.6 Keyframes that fight smooth flow
- **K24 to K25 lens:** 24 mm to 28 mm inside the crane. Fix: K25 at 24 mm with the camera ending about 4% closer (z 2.85 instead of 3.20); re-check the board framing.
- **K26 to K27 lens:** 32 mm to 28 mm inside the orbit. Fix: both at 28 mm.
- **K07 to K08 lens:** 32 mm to 35 mm inside the dolly-back. Fix: both at 35 mm.
- **K35 mug hand:** fixed in round 10 (left hand, as K30-K34).
- **K29:** the shortest shot (0.75 s visible); fast but fragile.
- **K51/K52:** too alike (known). This plan keeps the axis and differentiates by lens, the held gaze and K52's focus giving up; a profile is the stronger fix.
- **K12 to K13:** a 2.3 m jump of camera and a 90 deg change of side; it works only because the posture matches on the cut. Keep the phone-up pose identical.
- **K16 to K17:** the cut from a dimmed day to a 3 AM jolt is the smash on purpose. The Enter press at 64.05 must land with the hit.
