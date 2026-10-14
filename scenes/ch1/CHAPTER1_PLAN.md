# Chapter 1, "The Binge": shot plan

**Status:** plan only. Nothing here has been rendered or viewed in the engine yet.
**Timing:** every time below is an estimate, and must be re-locked to the Ch 1 voiceover when it arrives.
- Narration is timed at about 2.3 words/s, plus pauses.
- The typed dialogue (Ivan's message, Claude's reply) is timed at about 2.8 words/s.
- Lines A1–A6 keep the intro's measured caption times. That voiceover is real and reads at about 2.5 words/s.

**Files:**
- Machine-readable spine: `engine/scenes/ch1/timeline.json` (same data as the cards below)
- Storyboard panel map: `storyboards/PANELS.md`

**Sources:**
- `docs/script/life-on-claude-nine_ch1-3.md` (Ch 1; Ch 2–3 read for continuity)
- `engine/src/shots.js` (intro)
- `engine/scenes/s03/scene.js` and `scenes/03-ivan-room/PLAN.md` (the new room)
- `engine/scenes/s02/scene.js` and `scenes/02-cheat-code/STORYBOARD.md`
- `docs/WORLD_BIBLE.md`
- `scenes/ch1/storyboards/board_A/B/C`
- `reference/ours/04`, `reference/ours/05`
- `scenes/03-ivan-room/ref/look_night.webp`, `plan_topdown.jpg`

**Skill note:** `code-film-director` is not loaded as a live skill in this session. Its structure was followed from the reference package (`D:\CLAUDE\skills-packages\code-film-director.skill`): idea, arc, beats, cards, style, timeline.

## Numbers

| | |
|---|---|
| Length | **231.8 s (3:52)**, 5563 frames at 24 fps |
| Shots | **51** |
| Cut rate | 13.2 shots/min |
| Shot length | median 4.4 s, shortest 1.8 s (E08), longest 10.6 s (D03), final hold 10.0 s (F07) |
| Status: exists | **6**: running in s03 today (A01, A03–A07) |
| Status: reuse | **7**: an intro or s02 shot moved into the new room or re-staged (A02, B01, B07, C04, C05, E08, F06) |
| Status: new | **38** |
| Narration and dialogue | 382 words |

**Dropped from the intro** (the new script cut "Not because anyone asked him to. Because he realized he could."):
- S5a "Sent"
- S5 "Because he could". S5's lean-back performance (hands behind the head, exhale) is reused in F04 at sunrise.

## 1. Idea and feeling arc

**Controlling idea:** in one sleepless night a man hands every task in his life to a machine, and at sunrise he finds he has automated away his reason to get up.

**Feeling arc:** the audience starts cold and slightly amused, watching a tired man say yes to everything. Then:
1. A warm flashback gives relief and delight: the inbox problem solved.
2. The montage builds momentum.
3. The void is the peak of the high: euphoric, unreal and alone. This is the chapter's one style switch and its turn, at 42% of the runtime.
4. Back in the room, the high turns hollow: the unanswered text, the fraying.
5. At 4 AM the dread flips into a rush of pride when the module works.
6. Sunrise ends on emptiness. The light is warm at last, but he has nothing left to do.

**One image:** the full glass of water in front of the glowing screens, Ivan soft behind it (A04).

**Visual motif:** the full glass, seen three times:
- cold blue at 3 AM (A04);
- in the foreground of his proudest moment (E10);
- gold at sunrise, still full (F06).

**Musical motif:** a short four-note synth pluck.
- It speeds up through the montage.
- It peaks in the void.
- It lands loud on "HE built that".
- It returns once, slow, on a soft piano at sunrise.

## 2. Style bible (Chapter 1)

### Palette (tokens)

| Token | Hex | Meaning |
|---|---|---|
| `wall_night` | `#132220` | dark teal-green room (look_night) |
| `screen_blue` | `#8fb0ff` | the machine; cold key on his face |
| `lamp_amber` | `#ff994d` | home, the human side (lamp colour 1.0/0.60/0.30) |
| `city_sodium` | `#ffb35c` | the world outside, as bokeh |
| `city_red` | `#e0383a` | aviation lights, small alarms in the bokeh |
| `day_gold` | `#f3d29a` / `#f6ead2` | the flashback afternoon (board A r2c4): before |
| `claude_orange` | `#d97757` | Claude's mark in the UI (`screens.js` C.claude) |
| `sprite_yellow` | `#ffd43b` | the Claude sprite (board A r3c1) |
| `ok_green` | `#9df2bd` | the reward hit: tests pass, modules tick |
| `void_streaks` | `#ff2a1a` `#ff7a2a` `#ffd9c4` `#39e6e6` on `#05080a` | the high (board B r3c3/r3c4) |
| `sun` | `#ffb46b`, shadows stay `#1d2c33` | sunrise |

**Colour rules:**
- Blue is the machine; amber is the human.
- The chapter starts with amber pushed to the edge of frame: the lamp on the far nightstand, behind him.
- It ends with Ivan turned toward the amber sun and the blue screens at his back (F04).
- Green appears only when the system rewards him.
- The void palette is used nowhere else.

### Light states

All are listed in `engine/scenes/ch1/timeline.json` under `light_states`.

| State | Built how | Shots |
|---|---|---|
| `3am` | exists (room03 bake) | A, C05–C07, V04, D |
| `4am` | the 3am bake with live changes:<br>- lamp ×0.6<br>- screens ×1.3<br>- city windows −40%<br>- exposure −0.3 EV<br>- more haze | E02–E10, F01 start |
| `4am_iso` | 4am with every lightmap group except DESK dropped to ×0.12 (the bake groups already allow it) | E01 |
| `day` | **new bake**: warm afternoon, soft sun, screens weak, lamp off | B01–B07 |
| `dusk` / `evening` | **new bake**: blue dusk, city coming on, lamp on | C00–C03 |
| `sunrise` | **new bake**: low sun straight through the window; mullion shadows across the bed, the floor and Ivan | F01–F07 |
| `void` | a separate black stage | V01–V03 |

**Window direction (needs a decision, see open questions):** the plan calls the window wall "west". Sunrise can't come through a west window.
- **Proposal:** treat the window as east-facing. Only the label changes, not the geometry.
- The 3 AM moonlight from the same side then reads as a waning moon rising before dawn.

### Lens language

The camera rules are locked: one move per shot, real lenses from 18 to 100 mm, keyed focus pulls. Within those rules:

- **18–24 mm:** his world and his isolation (A01, B01, C04, V03, F07).
- **28–40 mm:** being in the room with him, over the shoulder.
- **50–60 mm:** character.
- **75–100 mm:** inside his head (eyes, lenses, keys). The closer to his mind, the longer the lens and the wider the aperture.
- **Focus pulls carry meaning:**
  - glass ↔ face (A04);
  - note → face (B07);
  - phone → screens (D02);
  - dashboard → face (E06);
  - his back → the door (V03).
- **The dolly zoom is used twice, as a pair:**
  - A05: the room crowds in (dread).
  - E09: reversed, the room opens out (rush).
- **Moves are small and eased:** the engine's cosine ease, 1–70 cm.
  - Pushes for pressure.
  - Ease-backs and rises for release (F04, F07).
  - Locked frames for time (B01, C03, C04, F02).

### Pacing

Measured references are in `taste/pacing-benchmarks.md`.
- **Whole chapter:** 13.2 shots/min, median 4.4 s. This sits between IDK Show "India" (12.0/min, 3.24 s) and fern "CIA" (17.4/min, 2.12 s).
- **Fastest beats:** the montage and the void (B3 15.7/min, B4 15.0/min).
- **4 AM:** 14.0/min. Its inserts run 1.8–2.6 s (fern-style macro cutting).
- **Slow beats:** "Barely slept" (10.8/min) and "Sunrise" (10.1/min). They hold long:
  - D03: 10.6 s
  - F07: 10.0 s
  - Toward Kurzgesagt "Scariest Place" (3.1/min) and Our Animated Box "Our Shadows" (2.3/min) for the final hold.
- **Re-hook:** something big changes at least every 8–10 s.
  - The longest stretch without a location, scale or style change is D03 (10.6 s), held on purpose.

### Borrow list

Contact sheets viewed for fern CIA, Kurzgesagt Scariest Place, Our Animated Box "Our Shadows" and "Who are you?".

| Reference | Colour | Pacing | Camera | Texture | Story device |
|---|---|---|---|---|---|
| fern, "The Kids Who Hacked The CIA" | cool grey-blue 3D rooms with one warm accent | 17.4/min, used in the 4 AM inserts | macro on hands, keys, mouse, phone (A09, B03, B06, E03, E07) | clean CG, shallow focus | the lone figure at a desk, hands telling the story |
| Kurzgesagt, "This Is the Scariest Place in the Universe" | near-black with sparse points of light | 3.1/min, long continuous moves | one slow push per shot in the void (V01–V03) | particles and soft glows | scale: a tiny figure in a vast dark (V01) |
| Our Animated Box, "Our Shadows" | pale ground, shadow as the graphic | 2.3/min, long holds | locked, patient frames | soft cast shadows | the shadow as the subject: the window's shadow cross on Ivan at sunrise (F04, F07) |
| Our Animated Box, "Who are you?" | one accent colour on a neutral base | 18.9/min overall; borrow only the vignette frame | — | dark vignette, a pool of light around the figure (their shot #21) | isolation frame for "It's not all pleasant" (E01) |
| `look_night.webp` (our look target) | teal room, amber lamp, blue screens, hazy bokeh city | — | — | haze, bloom, letterbox, soft shadows | — |

**Motion tokens:**
- Camera eases: cosine in-out on every move.
- Screen UI: ease-out pops in 6–12 frames for module tiles and icons, and hard cuts for impacts (the Enter key, the void, the white).
- No overshoot on the camera. UI overshoot is 4% at most.

## 3. Beat sheet

| Beat | Time (est.) | Script lines | Purpose | Feeling / temperature | Light | Sound |
|---|---|---|---|---|---|---|
| B1 3 AM | 0.0–37.0 | "It's 3 AM..." → "Ivan keeps saying yes." | Hook: Ivan alone, the full glass, the system; the thesis joke (Claude builds, he says yes) | cold, compelled, a dry laugh / low | 3am | room tone, fan, typing; sparse pulse; silence before "Well..."; three key taps |
| B2 Two days ago | 37.0–67.6 | "It started two days ago." → "Review and approve." | Flashback: overwhelmed, offered relief, says yes; the promise | frazzled → relief / low → rising | 3am → day | day city ambience, phone taps, sprite chime; first warm motif |
| B3 Cheat code | 67.6–98.2 | "But once the email system..." → "...now takes minutes." | Escalation: modules multiply, days blur | momentum, delight / rising | dusk → evening → time-lapse → 3am | module pops tuned to the motif; clock ticks accelerate and stop |
| B4 Another frequency | 98.2–114.2 | "Ivan feels like he's vibrating..." → "...can't even see." | **The turn**: the void, the door of light | euphoric, unreal, alone / peak | void | room sound cut; music at full; one high tone; silence on white |
| B5 Barely slept | 114.2–147.4 | [phone on the couch] "He's barely slept." → "Then he'll rest." | The cost: her text vs his system; he knows, keeps going | hollow, fraying / falling | 3am | buzz in the duvet, soft "sent" ticks, a thin whine on "thinness" |
| B6 4 AM | 147.4–190.2 | "It's not all pleasant." → "...what HE told it to do." | Crisis and release: dread → it works → rush → pride | dread → peak | 4am, 4am_iso, green spill | low heartbeat pulse, mug rattle, Enter hit, pass chord, motif lands |
| B7 Sunrise | 190.2–231.8 | [Dawn] "By sunrise..." → "...supposed to do now." | Return with a change; the button | exhausted and wired → empty / release | 4am → sunrise | birds, first traffic, the motif once on piano, then only room tone |

The voiceover lines with their estimated times are in `engine/scenes/ch1/timeline.json` → `vo`.

### Script and storyboard notes that shape the plan

1. **The new script wins over the old one** (`reference/ours/01-script...txt`).
   - "Not because anyone asked him to. Because he realized he could." is replaced by "Well... Technically, Claude is doing the building. Ivan keeps saying yes." This replaces S5a and S5 with A08 and A09.
   - The flashback is now typed dialogue.
   - "The feeling is hard to describe" and "Every tedious task can be automated away" are gone. Board B still carries the "the feeling is hard to describe" caption, and its panel is used for the void.
2. **"His phone lights up on the couch"**: the new room has no couch.
   - **Proposal: the bed.** The phone lives face-up on the duvet all night: A02 (3:04) and D02 (it lights up).
   - This also pays off "He's barely slept" and "Then he'll rest" (D06, the empty bed).
   - Board C r1c2 drew the phone on the desk. The bed keeps the staging (phone in front, laptop behind) and only changes the surface.
   - Ch 2 has a living room with a sofa. If that set is built later, this moment could move there.
3. **The flashback is set in the same desk chair, reclined, with the phone.**
   - Board A r2c4/r3c1 show Ivan sprawled back with a phone, warm light, a floating chat.
   - The script says "same desk, two days earlier, daylight". The chair reclining at the same desk satisfies both.
4. **The girlfriend's name:** Ch 2 calls her **Sarah**. The intro's E2 note and s02's mail list say "Sasha". Ch 1 screens use Sarah.
5. **Board order is followed where it sets a sequence:**
   - Board B r4c1 (the eye with streaks) comes after the void, so it is the return (V04), not the entry.
   - Board B r1c2 and B r3c1 are the same frame before and after (C03).
6. **Continuity planted for Ch 2–3:**
   - The mug count grows through the night.
   - The hoodie stays on the clothes pile (Ch 3: "same sweatshirt").
   - The door on the east wall stays dark (Ch 2: Sarah knocks).

## 4. Shot cards

Coordinates are Blender metres in `scenes/03-ivan-room`:
- x runs east, y north, z up.
- The window wall is at x = 0; the desk wall is at y = 4.8.

**Reference points used:**

| Point | Coordinates |
|---|---|
| Ivan's face (seated) | (1.04, 3.95, 1.12) |
| Laptop screen | (1.05, 4.458, 0.871) |
| Monitor 1 | (1.4575, 4.545, 1.066) |
| Monitor 2 | (2.017, 4.596, 1.066) |
| Glass | (0.76, 4.33, 0.84) |
| Lamp shade | (0.22, 0.52, 1.0) |
| Alarm clock | (0.22, 0.80, 0.70) |

The marks come from `engine/scenes/s03/room/lights.json`; the clock is from `set_room03.py`.

Intro and s02 shots are moved by OFF = (−5.90, 1.23, 0).

**Pick strings** follow `shots.js`: `eyes`, `lap:x,y`, `mon:x,y`.

**Wild wall:** cameras with y > 4.8 need the north wall pulled; `props()` in s03 already does this. E01, A01 and F07 pull the ceiling.

**Void shots:** they use the void stage's own frame. Ivan stands at the origin facing −y.

**Ivan's acting:**
- Every action is written as poses and times.
- Hands must stay out of the face and the glasses.
- Facial notes (smile, widen, squeeze shut) need eye and lid controls; see the build list.

### B1 3 AM (0.0-37.0 s)

**A01 Three AM** (was E1 (s03)) | 0.0-2.8 s (2.8 s, frames 0-67) | **exists**

- Script: (pre-VO opening, no line)
- Framing: top-down wide, ceiling pulled. Lens 18 -> 19 mm, f/5.6. Location: room. Light: 3am.
- Camera: from (2.25, 2.4, 3.45) to (2.15, 2.4, 3.2); look-at (0.85, 2.4, 0.35) -> (0.85, 2.42, 0.35). Move: slow descent, 0.27 m.
- Focus: fixed on the room floor plane, deep stop [(1.2, 2.4, 0.5)]
- Ivan: Ivan hunched at the desk, typing (intro performance).
- Screen: intro screens
- Props: existing set
- Board: ref plan_topdown.jpg (no board panel)
- Why: Straight down into his room: bed, guitar, rugs, the lamp, and at the edge of it all the one lit desk. He is small inside his world. Lens raised from 17 to 18 mm to keep inside the 18-100 mm rule.

**A02 3:04** (was E2 (intro)) | 2.8-5.0 s (2.2 s, frames 67-120) | **reuse**

- Script: (pre-VO opening, no line)
- Framing: insert, phone on the duvet. Lens 45 -> 50 mm, f/2. Location: room (bed). Light: 3am.
- Camera: from (1.86, 1.74, 0.7) to (1.85, 1.77, 0.685); look-at (1.8, 1.95, 0.53) -> (1.8, 1.96, 0.53). Move: creep in 3 cm with a slow zoom (as E2).
- Focus: locked on the lock-screen clock [(1.8, 1.95, 0.53)]
- Ivan: none in frame (Ivan typing off-screen; keyboard sound only)
- Screen: phone lock screen: 3:04, three unanswered texts from Sarah, Mail: 214 new
- Props: phone moved from the desk to the bed (north-east corner of the duvet)
- Board: gap fill (sets up C r1c2)
- Why: E2 re-staged on the bed: the phone lies three metres from him, face up and ignored. It is planted where it lights up again in D02.

**A03 The zone** (was S1 (s03)) | 5.0-9.9 s (4.9 s, frames 120-238) | **exists**

- Script: "It's 3 AM and Ivan hasn't eaten since lunch."
- Framing: wide, from the dark door corner. Lens 22 -> 26 mm, f/2.8. Location: room. Light: 3am.
- Camera: from (3.72, 0.4, 1.78) to (3.05, 1.45, 1.58); look-at (1.05, 4.42, 0.92) -> (1.05, 4.4, 1). Move: one long slow push across the room.
- Focus: on his eyes throughout [eyes]
- Ivan: typing, hunched (intro performance)
- Screen: intro screens
- Props: existing
- Board: A r1c1
- Why: One long slow push toward the only lit corner, where he works.

**A04 Still full** (was S2 (s03)) | 9.9-16.0 s (6.1 s, frames 238-384) | **exists**

- Script: "There's a glass of water on his desk... It's still full."
- Framing: desk height, glass foreground, Ivan behind. Lens 28 -> 30 mm, f/4. Location: room (desk). Light: 3am.
- Camera: from (0.552, 4.453, 0.8) to (0.57, 4.44, 0.803); look-at (1.32, 3.81, 1.07) -> (1.32, 3.8, 1.08). Move: hair-small drift.
- Focus: glass -> Ivan typing -> glass on "still full" [9.9s: (0.76, 4.33, 0.84), 12.2s: (0.76, 4.33, 0.84), 13.2s: eyes, 14.0s: eyes, 14.7s: (0.76, 4.33, 0.84)]
- Ivan: typing
- Screen: intro screens
- Props: the full glass (motif, frame 1 of 3)
- Board: A r1c2
- Why: The chapter's one image: the untouched glass in front of the glowing screens.

**A05 Bloodshot** (was S3 (s03)) | 16.0-20.6 s (4.6 s, frames 384-494) | **exists**

- Script: "He's hunched over his laptop, typing furiously, eyes bloodshot."
- Framing: CU face, dolly zoom. Lens 25 -> 54 (dolly zoom, k=43) mm, f/2. Location: room (desk, wild north wall). Light: 3am.
- Camera: from (1.06, 4.53, 1.03) to (1.07, 5.21, 1.03); look-at (1.04, 3.95, 1.12) -> (1.04, 3.95, 1.12). Move: dolly zoom: camera pulls back as the lens closes in.
- Focus: on his eyes [eyes]
- Ivan: hunches deeper, typing hard
- Screen: intro screens
- Props: existing
- Board: A r1c3
- Why: His face holds still while the room crowds in behind him.

**A06 Reading** (was S4 (s03)) | 20.6-26.6 s (6.0 s, frames 494-638) | **exists**

- Script: "A terminal window, a Claude chat, and a growing sprawl of Python scripts."
- Framing: over the left shoulder, close on the laptop. Lens 60 -> 66 mm, f/1.4. Location: room (desk). Light: 3am.
- Camera: from (0.9, 4.13, 1.4) to (0.92, 4.16, 1.37); look-at lap:300,740 -> lap:450,240. Move: tiny push; aim keyed along the screen (intro atKeys).
- Focus: focus moves line by line like his eyes [READ (intro keyed pulls, line by line)]
- Ivan: typing, reading
- Screen: terminal, Claude chat streaming, file list (intro screens)
- Props: existing
- Board: A r1c4
- Why: The screen read like his eyes read it. Caption text changes: the script dropped "On the screen:".

**A07 The pipeline** (was S4b (s03)) | 26.6-31.4 s (4.8 s, frames 638-754) | **exists**

- Script: "He's building an email automation system." + "Well..."
- Framing: behind him, head soft foreground, pipeline monitor. Lens 35 -> 38 mm, f/2.8. Location: room (desk). Light: 3am.
- Camera: from (0.82, 3.73, 1.28) to (0.96, 3.66, 1.3); look-at (1.46, 4.54, 1.07) -> (1.46, 4.54, 1.07). Move: slide sideways 15 cm.
- Focus: on the monitor [mon:800,240]
- Ivan: typing
- Screen: pipeline: inbox, classify, draft, review, send
- Props: optional: hand-drawn label "EMAIL AUTOMATION SYSTEM" with a pointer, as drawn on the board
- Board: A r2c1
- Why: The thing he is building, named. The board adds a hand-lettered callout; see open questions.

**A08 Claude builds** | 31.4-34.0 s (2.6 s, frames 754-816) | **new**

- Script: "Technically, Claude is doing the building."
- Framing: 3/4 side MS from his left front, laptop at frame left. Lens 40 mm, f/2. Location: room (desk). Light: 3am.
- Camera: from (0.45, 4.15, 1.15) to (0.47, 4.17, 1.15); look-at (1.04, 3.95, 1.12) -> (1.04, 3.96, 1.12). Move: drift 3 cm toward the desk.
- Focus: on his eyes; the full glass soft in the low foreground [eyes]
- Ivan: Ivan sits back 5 cm from the keyboard, hands lift off the keys and rest on the desk edge; he watches, eyes tracking the text; one small nod.
- Screen: laptop: Claude chat streams 'Writing classify.py... done. Writing draft_reply.py...'; the editor fills with code by itself
- Props: glass (foreground)
- Board: A r2c2
- Why: His hands are off the keyboard: the code writes itself. The first time we see who is really building.

**A09 Saying yes** | 34.0-37.0 s (3.0 s, frames 816-888) | **new**

- Script: "Ivan keeps saying yes."
- Framing: macro, keyboard from the right, screen soft above. Lens 85 mm, f/2.8. Location: room (desk). Light: 3am.
- Camera: from (1.3, 4.18, 0.84) to (1.29, 4.2, 0.83); look-at (1.1, 4.33, 0.765) -> (1.11, 4.33, 0.765). Move: creep in 2 cm.
- Focus: locked on the Y key [(1.1, 4.33, 0.765)]
- Ivan: Right index finger: Y, then Enter, three times, each faster (keys hit at 34.6, 35.4, 35.9 s).
- Screen: soft at frame top: 'Apply 3 changes? (y/n)' -> y -> 'Add tests? (y/n)' -> y -> 'Deploy? (y/n)' -> y
- Props: laptop keyboard (existing)
- Board: gap fill (A r2c3)
- Why: The joke of the chapter as an action: three yeses, faster each time.


### B2 Two days ago (37.0-67.6 s)

**B01 Two days ago** (was s02 2.1 (concept)) | 37.0-41.6 s (4.6 s, frames 888-998) | **reuse**

- Script: "It started two days ago."
- Framing: locked wide from the door wall: window left, desk right. Lens 24 mm, f/4. Location: room. Light: 3am -> day (blend 38.0-40.4).
- Camera: from (3.7, 2.7, 1.55) to (3.66, 2.72, 1.55); look-at (0.6, 3.6, 1.05) -> (0.6, 3.6, 1.05). Move: locked (4 cm drift).
- Focus: on Ivan [eyes]
- Ivan: Ivan stays hunched; the light runs backwards around him.
- Screen: screens dim to daytime brightness
- Props: dressing swap during the blend: mugs, wrappers and the poured glass fade out; one fresh mug in
- Board: gap fill (no panel; s02 2.1 design)
- Why: Time told by light alone: the night drains out of the same room and it is two days earlier.

**B02 Drowning** | 41.6-45.6 s (4.0 s, frames 998-1094) | **new**

- Script: IVAN: "i have like 400 unread emails. every single one wants a reply."
- Framing: MS, low, from the desk end; window blown out behind him. Lens 35 mm, f/2. Location: room (desk chair, reclined). Light: day.
- Camera: from (2.2, 4.25, 1) to (2.12, 4.2, 0.99); look-at (0.95, 3.55, 1.02) -> (0.95, 3.56, 1.02). Move: slow push 9 cm.
- Focus: on his eyes; the chat card soft at frame right [eyes]
- Ivan: Reclined far back in the desk chair, one sock foot on the desk-pedestal edge, phone held up in the right hand, thumb-typing; mouth moves (muttering), eyebrows up in exasperation.
- Screen: floating chat card (frame right, upper third, at ~[0.75, 3.90, 1.30]): his message types out letter by letter
- Props: phone in hand; floating chat card
- Board: A r2c4 "complaining to claude"
- Why: The board's frame: warm afternoon, Ivan sprawled, the chat floating beside him. He is a normal guy having a bad inbox day.

**B03 Send** | 45.6-48.2 s (2.6 s, frames 1094-1157) | **new**

- Script: IVAN: "i'm fucking drowning here!"
- Framing: insert over his left shoulder onto the phone. Lens 60 mm, f/2. Location: room (desk chair, reclined). Light: day.
- Camera: from (0.94, 3.52, 1.08) to (0.95, 3.54, 1.085); look-at (1.08, 3.74, 1.16) -> (1.08, 3.74, 1.16). Move: creep 2 cm.
- Focus: on the phone screen [(1.08, 3.74, 1.16)]
- Ivan: Thumb types the line, jabs Send at 47.6 s.
- Screen: phone: Mail badge 412 unread at the top; Claude chat, his message, Send
- Props: phone in hand
- Board: gap fill
- Why: The macro insert on hands and phone (fern's device) gives the line a physical action.

**B04 Hello, Claude** | 48.2-52.6 s (4.4 s, frames 1157-1262) | **new**

- Script: CLAUDE: "That sounds genuinely exhausting - and you're definitely not alone!"
- Framing: CU 3/4 from his right front, phone at frame left, sprite top left. Lens 50 mm, f/2. Location: room (desk chair, reclined). Light: day.
- Camera: from (1.4, 4.02, 1.18) to (1.38, 4, 1.18); look-at (1.02, 3.64, 1.1) -> (1.02, 3.64, 1.1). Move: settle 3 cm.
- Focus: on his eyes; the sprite is a soft glow [eyes]
- Ivan: At 48.3 s the sprite pops out above the phone; Ivan's head jerks back 3 cm, eyes up to it, mouth opens (surprise), then a short laugh breath.
- Screen: phone reply bubble; the glowing yellow Claude sprite above the phone (~[1.00, 3.82, 1.32])
- Props: Claude sprite
- Board: A r3c1
- Why: The board's surprise beat: the help arrives as a cheerful little character. Claude is friendly before it is anything else.

**B05 The offer** | 52.6-58.0 s (5.4 s, frames 1262-1392) | **new**

- Script: CLAUDE: "I can write a script that sorts your inbox and drafts the replies for you."
- Framing: over his left shoulder onto the floating card. Lens 40 mm, f/2.8. Location: room (desk chair, reclined). Light: day.
- Camera: from (0.68, 3.3, 1.22) to (0.72, 3.36, 1.22); look-at (0.8, 3.95, 1.28) -> (0.8, 3.95, 1.28). Move: push 7 cm toward the card.
- Focus: on the card; his head soft in the right foreground [(0.75, 3.9, 1.3)]
- Ivan: Reading; slow nod; thumb hovers.
- Screen: card: Claude's reply streams in, with a small sketch of the pipeline (inbox -> sort -> draft -> you)
- Props: floating chat card
- Board: gap fill (A r3c2)
- Why: We read the offer with him.

**B06 yes** | 58.0-62.8 s (4.8 s, frames 1392-1507) | **new**

- Script: CLAUDE: "You just review and approve. Want me to build one?"
- Framing: tight insert on the phone and thumb. Lens 85 mm, f/2.8. Location: room (desk chair, reclined). Light: day.
- Camera: from (0.96, 3.55, 1.1) to (0.97, 3.57, 1.11); look-at (1.08, 3.74, 1.16) -> (1.08, 3.74, 1.16). Move: creep 2 cm.
- Focus: on the reply box [(1.08, 3.74, 1.16)]
- Ivan: After the question, the thumb types 'yes' (61.6-62.2 s) and sends.
- Screen: reply box: 'yes' -> sent
- Props: phone
- Board: gap fill (A r3c3)
- Why: The first yes. A08/A09 already showed where it leads.

**B07 The plan** (was s02 2.7) | 62.8-67.6 s (4.8 s, frames 1507-1622) | **reuse**

- Script: "That was the plan. Review and approve."
- Framing: CU sticky note on the back of the laptop lid, Ivan behind. Lens 85 mm, f/2. Location: room (desk, wild north wall). Light: day.
- Camera: from (1.13, 4.83, 0.93) to (1.12, 4.76, 0.935); look-at (1.12, 4.48, 0.93) -> (1.07, 4.23, 1.07). Move: creeping push 7 cm, aim tilts up to his face.
- Focus: note -> his face (the focus leaves the promise) [62.8s: (1.12, 4.489, 0.925), 64.9s: (1.12, 4.489, 0.925), 66.1s: eyes]
- Ivan: Now sitting up at the laptop, typing, pleased; does not look at the note.
- Screen: laptop back only
- Props: sticky note REVIEW + APPROVE (port from s02, NOTE moved by OFF)
- Board: gap fill (A r3c4)
- Why: The promise on a sticky note; the focus slipping off it says he won't keep it.


### B3 Cheat code (67.6-98.2 s)

**C00 Dusk** | 67.6-69.6 s (2.0 s, frames 1622-1670) | **new**

- Script: (no line, a breath)
- Framing: the window glass, city out of focus. Lens 50 mm, f/1.4. Location: room (window). Light: dusk (day -> evening).
- Camera: from (0.45, 2.3, 1.55) to (0.45, 2.42, 1.55); look-at (-3, 2.25, 1.45) -> (-3, 2.37, 1.45). Move: slide 12 cm along the glass.
- Focus: on the glass, the city is pure bokeh [(0, 2.33, 1.52)]
- Ivan: none
- Screen: none
- Props: city lights switching on (house windows, street lights, red aviation lights)
- Board: B r1c1
- Why: Time passes in one breath; the city becomes bokeh, the seed of the light streaks in B4.

**C01 It works** | 69.6-72.8 s (3.2 s, frames 1670-1747) | **new**

- Script: "But once the email system was working,"
- Framing: front, floating pipeline cards sharp, Ivan soft behind. Lens 40 mm, f/2.8. Location: room (desk). Light: evening.
- Camera: from (1.04, 4.75, 1.18) to (1.04, 4.7, 1.18); look-at (1.04, 3.92, 1.14) -> (1.04, 3.92, 1.14). Move: push 5 cm.
- Focus: on the cards; Ivan soft [(1.04, 4.2, 1.22)]
- Ivan: Ivan watches, typing a little; small satisfied exhale.
- Screen: floating cards: inbox stack -> gear turning -> drafts stack, an arrow looping back; cards tick green
- Props: floating UI cards
- Board: B r2c1 "But once the email system"
- Why: The system running on its own, drawn the way the board draws it.

**C02 What else** | 72.8-75.4 s (2.6 s, frames 1747-1810) | **new**

- Script: "Ivan saw what else was possible."
- Framing: ECU both eyes through the glasses, front. Lens 85 mm, f/2. Location: room (desk). Light: evening.
- Camera: from (1.04, 4.3, 1.16) to (1.04, 4.27, 1.16); look-at (1.04, 3.93, 1.15) -> (1.04, 3.93, 1.15). Move: creep 3 cm.
- Focus: on the eyes [eyes]
- Ivan: Eyes slide to his right (73.2 s), hold, then come back to camera and widen (74.3 s); brows lift.
- Screen: reflection in the lenses: the green pipeline cards
- Props: glasses reflection
- Board: B r2c3 + B r2c4 (one shot); B r1c3 folded in
- Why: An idea, played in the eyes only.

**C03 Modules** | 75.4-80.6 s (5.2 s, frames 1810-1934) | **new**

- Script: "Calendar management. Meeting scheduling. Document drafting. Research summaries."
- Framing: locked from behind: Ivan's back, desk, monitors. Lens 28 mm, f/4. Location: room (desk). Light: evening.
- Camera: from (1.05, 2.55, 1.55) to (1.05, 2.6, 1.54); look-at (1.05, 4.55, 1.05) -> (1.05, 4.55, 1.05). Move: locked (5 cm drift).
- Focus: deep; everything readable [(1.05, 4, 1.1)]
- Ivan: Typing; at each icon his head ticks slightly toward it.
- Screen: icons pop out around the monitors on each word: calendar 75.6, meeting/clock 76.8, document 78.0, research/magnifier 79.2; the monitor tiles light one by one
- Props: floating icon cards (calendar, clock, docs, folders, gears)
- Board: B r1c2 (start frame) -> B r3c1 (end frame)
- Why: Board B's same frame before and after: the empty desk, then the desk surrounded by his new machines.

**C04 Hours** (was s02 2.10 (concept)) | 80.6-84.2 s (3.6 s, frames 1934-2021) | **reuse**

- Script: "Each one a few hours of coding."
- Framing: locked wide from the door corner. Lens 20 mm, f/8. Location: room. Light: time-lapse: evening -> 3am -> sunrise -> day -> evening.
- Camera: from (3.7, 0.45, 1.75) to (3.7, 0.45, 1.75); look-at (1.05, 4.2, 0.95) -> (1.05, 4.2, 0.95). Move: locked.
- Focus: deep [(1.05, 4, 1)]
- Ivan: Ivan at 8x: typing, standing, stretching, sitting; mugs appear on the desk.
- Screen: flicker of code
- Props: mug count rises 1 -> 3
- Board: gap fill (s02 2.10)
- Why: Days blur in 3.6 s, told by light.

**C05 Checked off** (was s02 2.11 + S4 camera) | 84.2-88.6 s (4.4 s, frames 2021-2126) | **reuse**

- Script: "Each one removing another task from his daily routine."
- Framing: over the left shoulder on the laptop to-do list. Lens 60 -> 64 mm, f/1.6. Location: room (desk). Light: 3am.
- Camera: from (0.9, 4.13, 1.4) to (0.92, 4.16, 1.37); look-at lap:560,260 -> lap:560,520. Move: tiny push, aim down the list.
- Focus: rack down the list as items tick [84.2s: lap:420,200, 85.4s: lap:420,260, 86.4s: lap:420,340, 87.4s: lap:420,420, 88.4s: lap:420,500]
- Ivan: Hands still; he watches.
- Screen: TODO.md items check themselves off, then 'nothing left.' (s02 todo())
- Props: existing
- Board: gap fill (s02 2.11)
- Why: His routine erased line by line.

**C06 Cheat code** | 88.6-93.0 s (4.4 s, frames 2126-2232) | **new**

- Script: "It's like discovering a cheat code for life."
- Framing: MS front, hands on the keyboard. Lens 50 mm, f/2. Location: room (desk, wild north wall). Light: 3am.
- Camera: from (1.06, 4.95, 1.22) to (1.06, 4.88, 1.21); look-at (1.04, 3.92, 1.05) -> (1.04, 3.92, 1.05). Move: push 7 cm.
- Focus: on his eyes [eyes]
- Ivan: Fingers spread on the keys; mouth opens to a small 'o', then a slow private smile; chin lifts 2 degrees.
- Screen: screen glow only
- Props: none
- Board: B r2c2
- Why: Wonder, quietly. The board's open-mouthed delight.

**C07 Hours to minutes** (was s02 2.13 (concept)) | 93.0-98.2 s (5.2 s, frames 2232-2357) | **new**

- Script: "Every problem that used to take hours now takes minutes."
- Framing: alarm clock large in the left foreground by the lamp, Ivan tiny at the lit desk far right. Lens 35 mm, f/2. Location: room (nightstand). Light: 3am.
- Camera: from (0.48, 0.5, 0.86) to (0.47, 0.52, 0.86); look-at (0.2, 2.48, 0.88) -> (0.2, 2.48, 0.88). Move: drift 2 cm.
- Focus: clock -> Ivan as the hands stop [93.0s: (0.22, 0.8, 0.78), 96.8s: (0.22, 0.8, 0.78), 97.6s: eyes]
- Ivan: Ivan types far away, small.
- Screen: none
- Props: alarm clock hands overlay: spin 9:12 PM -> 2:58 AM between 94.4 and 96.6 s, then stop
- Board: gap fill (s02 2.13)
- Why: Hours collapse into seconds; the lamp and the bed he isn't using sit right beside the clock.


### B4 Another frequency (98.2-114.2 s)

**V01 Frequency** | 98.2-102.8 s (4.6 s, frames 2357-2467) | **new**

- Script: "Ivan feels like he's vibrating at a different frequency"
- Framing: wide, Ivan small just left of centre on black. Lens 50 mm, f/2.8. Location: void (stage frame: Ivan at origin facing -y). Light: void.
- Camera: from (0, -6, 1.2) to (0, -5.5, 1.2); look-at (0.3, 0, 0.9) -> (0.3, 0, 0.9). Move: slow push 0.5 m.
- Focus: on Ivan [(0, 0, 1)]
- Ivan: Standing, hands loose, looking ahead; breathing. A faint glow pools at his feet.
- Screen: none
- Props: void stage; one warm streak passes low behind him at 100.5 s
- Board: B r3c2
- Why: Hard cut from the room into nothing: the board's small figure on black.

**V02 Everyone around him** | 102.8-105.0 s (2.2 s, frames 2467-2520) | **new**

- Script: "than everyone around him,"
- Framing: full figure, streaks in front and behind. Lens 35 mm, f/1.4. Location: void. Light: void.
- Camera: from (0, -3.2, 1.1) to (0, -3, 1.1); look-at (0, 0, 1) -> (0, 0, 1). Move: push 0.2 m.
- Focus: on Ivan; streaks are big soft blobs [(0, 0, 1)]
- Ivan: Still; the two ghost copies (s02 vibrate) shake around him while every streak drifts slowly.
- Screen: none
- Props: bokeh streaks red/orange/peach/cyan; ghost doubles
- Board: B r3c3
- Why: The world drifts slowly; only he is humming fast.

**V03 The door** | 105.0-111.6 s (6.6 s, frames 2520-2678) | **new**

- Script: "like he's stepped through a door that others can't even see."
- Framing: low, from behind his shoulder, a tunnel of light streaks. Lens 24 mm, f/2. Location: void. Light: void -> white.
- Camera: from (0.25, 1.6, 1) to (0.15, 0.9, 1.15); look-at (0, -8, 2) -> (0, -8, 2). Move: push 0.7 m past his shoulder.
- Focus: his back -> the door [105.0s: (0, 0, 1.5), 108.6s: (0, 0, 1.5), 109.6s: (0, -8, 1.2)]
- Ivan: He takes one step forward (107.5 s), then stands; head tilts up.
- Screen: none
- Props: streak tunnel rushing toward a vanishing point; at 109.0 s the streaks part into a tall slot of white light (the door); bloom to white 110.6-111.6
- Board: B r3c4
- Why: The door only he can see. The peak of the high.

**V04 Back** | 111.6-114.2 s (2.6 s, frames 2678-2741) | **new**

- Script: (no line)
- Framing: ECU right eye through the lens. Lens 100 mm, f/2. Location: room (desk). Light: 3am.
- Camera: from (1.2, 4.18, 1.17) to (1.17, 4.15, 1.16); look-at (1.02, 3.93, 1.15) -> (1.02, 3.93, 1.15). Move: creep 4 cm.
- Focus: on the eye [eyes]
- Ivan: One slow blink; the eye refocuses.
- Screen: in the lens: warm streaks slow down and turn back into lines of code
- Props: glasses reflection
- Board: B r4c1
- Why: Out of the white and back into his eye: the streaks were the screen all along.


### B5 Barely slept (114.2-147.4 s)

**D01 Barely slept** | 114.2-117.8 s (3.6 s, frames 2741-2827) | **new**

- Script: "He's barely slept."
- Framing: MS through the window from outside, glass reflections over him. Lens 50 mm, f/2. Location: room (window, camera outside). Light: 3am.
- Camera: from (-0.7, 2.05, 1.55) to (-0.6, 2.1, 1.55); look-at (0.42, 2.4, 1.6) -> (0.42, 2.4, 1.6). Move: push 11 cm toward the glass.
- Focus: on his eyes through the glass [eyes]
- Ivan: Standing at the window, mug in the right hand at chest height, looking out at the city; he doesn't drink.
- Screen: none
- Props: standing Ivan, mug in hand, window exterior face
- Board: C r1c1 "He barely slept"
- Why: Glass between him and the world, as the board draws it. Fallback camera inside at [1.40, 3.20, 1.50] if the exterior face doesn't hold up.

**D02 Unanswered** | 117.8-126.4 s (8.6 s, frames 2827-3034) | **new**

- Script: "His girlfriend stopped texting... Ironic, given that his system now responds to everyone else." + [phone lights up on the couch]
- Framing: low on the duvet: phone foreground, the desk and Ivan's back deep in frame. Lens 35 mm, f/2. Location: room (bed -> desk). Light: 3am.
- Camera: from (1.7, 1.55, 0.72) to (1.68, 1.62, 0.72); look-at (1.7, 3.51, 0.34) -> (1.68, 3.55, 0.36). Move: push 7 cm.
- Focus: phone -> the monitors as the phone goes dark [117.8s: (1.8, 1.95, 0.53), 122.2s: (1.8, 1.95, 0.53), 123.2s: mon:800,400]
- Ivan: Ivan at the desk, back to camera, typing; never turns.
- Screen: phone wakes at 118.0 s: 'Sarah: are you ok?' (buzz), dims at 122.0 s; monitor: auto-replies fire 'Sent v' x12
- Props: phone on the bed, notification glow on the duvet
- Board: C r1c2 "gf stopped texting" + C r1c3 "system responds to everyone" (one shot)
- Why: One focus pull says the irony: her message in the foreground, his machine answering everyone else behind.

**D03 Thinness** | 126.4-137.0 s (10.6 s, frames 3034-3288) | **new**

- Script: "He knows this isn't healthy. He can feel something fraying..., a thinness to his thoughts."
- Framing: CU from the desk end, past his face to the window bokeh. Lens 55 mm, f/1.8. Location: room (desk). Light: 3am.
- Camera: from (1.92, 4.36, 1.2) to (1.78, 4.3, 1.18); look-at (1.04, 3.95, 1.12) -> (1.04, 3.95, 1.12). Move: very slow push 15 cm over 10.6 s.
- Focus: on his eyes [eyes]
- Ivan: Mug at his lips, sips, holds it there; eyes heavy, half-lidded; at 130 s his gaze drifts off the screen to nothing.
- Screen: monitor bokeh
- Props: mug in hand; from 129.4 s the city bokeh behind him stretches into thin horizontal lines
- Board: C r1c4 "he knows it's not healthy" + C r2c1 "thinness to his thoughts" (one shot)
- Why: Held a beat longer than comfortable; the world behind him thins out while he stays still.

**D04 Close to something** | 137.0-140.2 s (3.2 s, frames 3288-3365) | **new**

- Script: "But he's close to something."
- Framing: OTS close, his profile left, screen bokeh right. Lens 60 mm, f/1.6. Location: room (desk). Light: 3am.
- Camera: from (1.25, 3.7, 1.25) to (1.24, 3.74, 1.24); look-at (1, 4.15, 1.1) -> (1, 4.15, 1.1). Move: creep 4 cm.
- Focus: on his lips and the mug [(1.06, 3.98, 1.1)]
- Ivan: Drains the last of the coffee in one tilt, puts the mug down hard, leans in.
- Screen: bokeh
- Props: mug
- Board: C r2c2 "one more mode... then he'll rest"
- Why: Decision in one gesture: finish the cup, lean in.

**D05 One more** | 140.2-143.4 s (3.2 s, frames 3365-3442) | **new**

- Script: "One more module. One more integration."
- Framing: insert on the second monitor. Lens 50 mm, f/2.8. Location: room (desk). Light: 3am.
- Camera: from (1.64, 4.14, 1.1) to (1.67, 4.18, 1.09); look-at (2.017, 4.596, 1.066) -> (2.017, 4.596, 1.066). Move: push 5 cm.
- Focus: on the editor [(2.017, 4.596, 1.066)]
- Ivan: (off-screen) typing
- Screen: Monitor2 (live): new tab modules/briefing.py opens (140.6 s), then integrations/slack.py (141.9 s); 'Proceed? (y/n) y'
- Props: Monitor2 needs a live canvas
- Board: gap fill (C r2c3)
- Why: 'One more' made literal: two new files in three seconds.

**D06 Then he'll rest** | 143.4-147.4 s (4.0 s, frames 3442-3538) | **new**

- Script: "Then he'll rest."
- Framing: the empty bed in lamplight, from its foot. Lens 35 mm, f/2.8. Location: room (bed). Light: 3am.
- Camera: from (1.3, 2.7, 0.95) to (1.3, 2.62, 0.93); look-at (0.95, 0.55, 0.62) -> (0.95, 0.55, 0.62). Move: slow push 8 cm.
- Focus: on the pillows [(1, 0.45, 0.6)]
- Ivan: none (typing heard off-screen)
- Screen: phone dark on the duvet
- Props: bed, lamp on
- Board: gap fill (C r2c4)
- Why: The rest he promises, empty and waiting. Hold past the line.


### B6 4 AM (147.4-190.2 s)

**E01 Not all pleasant** | 147.4-150.8 s (3.4 s, frames 3538-3619) | **new**

- Script: "It's not all pleasant."
- Framing: high angle: the desk alone in a pool of light, the room black. Lens 35 mm, f/4. Location: room (ceiling pulled). Light: 4am_iso.
- Camera: from (2.9, 2.4, 3.6) to (2.85, 2.45, 3.45); look-at (1.1, 4.1, 0.6) -> (1.1, 4.1, 0.6). Move: slow descent 16 cm.
- Focus: on Ivan [(1.05, 3.95, 0.95)]
- Ivan: Typing, hunched lower than at 3 AM.
- Screen: screens bright
- Props: none
- Board: C r3c1 "it's not all pleasant"
- Why: The board's isolation frame (and the dark vignette of 'Who are you?'): nothing exists but the desk.

**E02 Eyes burn** | 150.8-154.4 s (3.6 s, frames 3619-3706) | **new**

- Script: "Around 4 AM, when his eyes burn"
- Framing: low CU from the laptop, face lit from below. Lens 60 mm, f/1.8. Location: room (desk). Light: 4am.
- Camera: from (1.04, 4.38, 1) to (1.04, 4.35, 1); look-at (1.04, 3.93, 1.14) -> (1.04, 3.93, 1.14). Move: creep 3 cm.
- Focus: on his eyes [eyes]
- Ivan: Screws his eyes shut hard (151.6 s), opens them wide, two fast blinks; no hands to the face.
- Screen: code reflected in the lenses
- Props: bloodshot sclera + dark under-eyes (material variant)
- Board: C r3c2 "eyes burn"
- Why: The laptop's view of him: what the machine sees.

**E03 Hands shake** | 154.4-158.0 s (3.6 s, frames 3706-3792) | **new**

- Script: "and his hands shake from a caffeine overload,"
- Framing: top-down over the laptop: left hand typing, right hand lifting the mug. Lens 40 mm, f/2.8. Location: room (desk). Light: 4am.
- Camera: from (1.2, 4.15, 1.45) to (1.19, 4.16, 1.43); look-at (1.1, 4.28, 0.78) -> (1.1, 4.28, 0.78). Move: creep 2 cm.
- Focus: on the keys; the mug shakes into blur [(1.08, 4.3, 0.77)]
- Ivan: Left hand keeps typing; right hand lifts the mug (155.0 s) and it trembles (8-10 Hz, 3-5 mm), coffee ripples, a drop spills.
- Screen: code
- Props: mug in hand, coffee surface ripple, spill drop
- Board: C r3c3 "hands shake coffee"
- Why: The body failing in one small physical detail.

**E04 Creeping dread** | 158.0-162.4 s (4.4 s, frames 3792-3898) | **new**

- Script: "Ivan feels a creeping dread."
- Framing: wide from the dark bed side, Ivan small and lit. Lens 32 mm, f/2. Location: room. Light: 4am.
- Camera: from (2.6, 1.3, 1.3) to (2.36, 1.78, 1.28); look-at (1.05, 4, 1.05) -> (1.05, 4, 1.05). Move: slow creeping push 0.54 m.
- Focus: on Ivan [eyes]
- Ivan: Stops typing (159.0 s); shoulders rise; he doesn't turn.
- Screen: screens
- Props: none
- Board: gap fill
- Why: A01/A03's push again, now from the dark like something approaching him. The camera is the dread.

**E05 Doesn't understand** | 162.4-167.8 s (5.4 s, frames 3898-4027) | **new**

- Script: "A sense that he's building something he doesn't fully understand."
- Framing: ECU eyes from just above, code streaming in the lenses. Lens 100 mm, f/2. Location: room (desk). Light: 4am.
- Camera: from (1.06, 4.22, 1.22) to (1.05, 4.2, 1.21); look-at (1.04, 3.93, 1.15) -> (1.04, 3.93, 1.15). Move: creep 2 cm.
- Focus: on the eyes; the reflection soft [eyes]
- Ivan: Eyes flick left-right trying to read, fall behind, slow down, stop.
- Screen: lens reflection: code scrolling too fast to read
- Props: glasses reflection; bloodshot variant
- Board: C r3c4 "he doesn't fully understand"
- Why: The board's reference frame: code in his glasses, faster than he can read.

**E06 Takes and gives** | 167.8-174.2 s (6.4 s, frames 4027-4181) | **new**

- Script: "That each automation takes something from him, even as it gives something back."
- Framing: behind his left shoulder: his face soft left, dashboard sharp right. Lens 50 mm, f/2. Location: room (desk). Light: 4am.
- Camera: from (0.62, 3.8, 1.18) to (0.64, 3.86, 1.18); look-at (1.4575, 4.545, 1.066) -> (1.4575, 4.545, 1.066). Move: creep 6 cm.
- Focus: dashboard -> his face [167.8s: mon:800,450, 170.6s: mon:800,450, 171.6s: eyes]
- Ivan: Still; the screen light on his face drops a stop over the shot (live key x0.5); his shoulders sink.
- Screen: dashboard: 'hours saved' counter climbing 31h -> 44h
- Props: none
- Board: gap fill
- Why: Gain on the screen, loss on his face, linked by one focus pull.

**E07 Enter** | 174.2-176.8 s (2.6 s, frames 4181-4243) | **new**

- Script: "But then he finishes another module,"
- Framing: macro from above the keys: one finger coming down on Enter. Lens 85 mm, f/2.8. Location: room (desk). Light: 4am.
- Camera: from (1.18, 4.4, 0.88) to (1.18, 4.39, 0.875); look-at (1.17, 4.31, 0.765) -> (1.17, 4.31, 0.765). Move: creep 1 cm.
- Focus: on Enter [(1.17, 4.31, 0.765)]
- Ivan: Right middle finger raised, held, comes down hard on Enter at 175.8 s.
- Screen: none in frame
- Props: laptop keyboard
- Board: C r4c1 "finishes another module"
- Why: Cut on the key hit.

**E08 It works** (was S4 camera) | 176.8-178.6 s (1.8 s, frames 4243-4286) | **reuse**

- Script: "and it works,"
- Framing: over the left shoulder on the terminal. Lens 66 mm, f/1.4. Location: room (desk). Light: 4am + green spill.
- Camera: from (0.9, 4.13, 1.4) to (0.91, 4.15, 1.385); look-at lap:400,850 -> lap:400,850. Move: hair push.
- Focus: on the result line [lap:400,850]
- Ivan: (still)
- Screen: terminal: tests run, '42 passed' in green at 177.0 s; the green floods the screen
- Props: none
- Board: gap fill (C r4c2)
- Why: The hit, on screen.

**E09 Rush** | 178.6-183.4 s (4.8 s, frames 4286-4402) | **new**

- Script: "and the dread dissolves into a rush of pure satisfaction."
- Framing: CU face, reverse dolly zoom. Lens 52 -> 26 (dolly zoom, k=43) mm, f/2. Location: room (desk, wild north wall). Light: 4am -> warm-green spill.
- Camera: from (1.07, 5.15, 1.1) to (1.06, 4.55, 1.1); look-at (1.04, 3.95, 1.12) -> (1.04, 3.95, 1.12). Move: reverse dolly zoom: camera pushes in as the lens widens; the room opens out behind him.
- Focus: on his eyes [eyes]
- Ivan: Exhale through the nose, shoulders drop, a grin spreads; eyes shine.
- Screen: green light on his face, turning warmer
- Props: none
- Board: gap fill (C r4c3)
- Why: A05's dolly zoom reversed: then the room crowded in, now it releases him.

**E10 HE built that** | 183.4-190.2 s (6.8 s, frames 4402-4565) | **new**

- Script: "HE... built that. The machine does what HE told it to do."
- Framing: low angle from the desk top, the full glass soft in the foreground. Lens 28 mm, f/2.8. Location: room (desk). Light: 4am (warmed).
- Camera: from (0.68, 4.46, 0.82) to (0.69, 4.44, 0.84); look-at (1.04, 3.9, 1.25) -> (1.04, 3.9, 1.25). Move: slow rise 2 cm toward him.
- Focus: on his eyes; the glass soft [eyes]
- Ivan: Sits up straight, chin lifts, a slow proud nod on each 'HE' (183.8 s, 186.8 s).
- Screen: screens behind/below
- Props: full glass (motif, frame 2 of 3)
- Board: gap fill
- Why: The hero angle, with the untouched glass still in the frame.


### B7 Sunrise (190.2-231.8 s)

**F01 Dawn** | 190.2-194.8 s (4.6 s, frames 4565-4675) | **new**

- Script: [Dawn at the window.] (no line)
- Framing: wide on the window from inside. Lens 28 mm, f/4. Location: room (window). Light: 4am -> sunrise (blend 190.6-194.4).
- Camera: from (2.4, 3.2, 1.45) to (2.3, 3.05, 1.45); look-at (0, 2.35, 1.55) -> (0, 2.3, 1.55). Move: push 18 cm.
- Focus: on the window [(0, 2.35, 1.55)]
- Ivan: none in frame
- Screen: none
- Props: city lights go out in waves; sky warms; sun breaks behind the towers
- Board: gap fill
- Why: A wordless breath; the night ends by itself.

**F02 By sunrise** (was C03 framing) | 194.8-198.4 s (3.6 s, frames 4675-4762) | **new**

- Script: "By sunrise, Ivan has a system"
- Framing: locked from behind (C03's frame), now sunlit. Lens 28 mm, f/4. Location: room (desk). Light: sunrise.
- Camera: from (1.05, 2.55, 1.55) to (1.05, 2.62, 1.54); look-at (1.05, 4.55, 1.05) -> (1.05, 4.55, 1.05). Move: locked (7 cm drift).
- Focus: deep [(1.05, 4, 1.1)]
- Ivan: Typing slows; stops.
- Screen: monitors
- Props: window-frame shadows across the floor and his back; mugs x4
- Board: B r1c2 (callback)
- Why: The same frame as the montage, with the work done.

**F03 Four tiles** | 198.4-204.8 s (6.4 s, frames 4762-4915) | **new**

- Script: "that handles his email, manages his calendar, drafts his documents, and summarizes his reading."
- Framing: insert on the dashboard monitor. Lens 50 mm, f/2.8. Location: room (desk). Light: sunrise.
- Camera: from (1.46, 4.05, 1.1) to (1.46, 4.1, 1.1); look-at (1.4575, 4.545, 1.066) -> (1.4575, 4.545, 1.066). Move: push 5 cm.
- Focus: on the tiles [mon:800,450]
- Ivan: (none)
- Screen: dashboard tiles tick green on each word: email 199.2, calendar 200.5, documents 202.0, reading 203.8; 'all systems running'
- Props: sun glare sliding across the screen
- Board: gap fill
- Why: The list on screen, ticked off on the words.

**F04 Leans back** (was S5 performance) | 204.8-210.4 s (5.6 s, frames 4915-5050) | **new**

- Script: "He leans back in his chair, exhausted and wired."
- Framing: MS from the window side: sun on his front, blue screens behind him. Lens 40 mm, f/2.4. Location: room (desk chair, turned to the window). Light: sunrise.
- Camera: from (0.36, 2.62, 1.25) to (0.33, 2.55, 1.25); look-at (1.02, 3.5, 1.1) -> (1.02, 3.5, 1.1). Move: ease back 8 cm.
- Focus: on his eyes [eyes]
- Ivan: Pushes back from the desk, swivels the chair ~130 degrees to face the window, leans back, hands behind his head (intro S5 acting), eyes half shut in the sun.
- Screen: screens glowing behind him
- Props: chair swivel + recline; mullion shadow cross on his chest
- Board: C r4c4 (colour panel)
- Why: The board's last panel: warm sun on him, the cold screens at his back.

**F05 Now what** | 210.4-218.0 s (7.6 s, frames 5050-5232) | **new**

- Script: "Then he realizes... he doesn't know what he's supposed to do now."
- Framing: CU face in the sun. Lens 75 mm, f/2. Location: room (desk chair, turned). Light: sunrise.
- Camera: from (0.62, 2.95, 1.18) to (0.63, 2.97, 1.18); look-at (1.02, 3.5, 1.12) -> (1.02, 3.5, 1.12). Move: near-locked (2 cm).
- Focus: on his eyes [eyes]
- Ivan: Eyes open (211.0 s); the half-smile fades; he looks to the window, then down, then at nothing; hands come down from his head slowly (215 s).
- Screen: none
- Props: none
- Board: gap fill
- Why: The realization plays on his face in silence after the line.

**F06 Still full** (was S2 camera) | 218.0-221.8 s (3.8 s, frames 5232-5323) | **reuse**

- Script: (no line)
- Framing: desk height, the full glass foreground, Ivan beyond facing the window. Lens 30 mm, f/2.8. Location: room (desk). Light: sunrise.
- Camera: from (0.552, 4.453, 0.8) to (0.57, 4.44, 0.803); look-at (1.1, 3.6, 1.05) -> (1.1, 3.6, 1.05). Move: hair drift (A04's camera).
- Focus: on the glass [(0.76, 4.33, 0.84)]
- Ivan: Sits still, facing the window.
- Screen: none
- Props: the full glass in the sun, a caustic on the desk (motif, frame 3 of 3)
- Board: gap fill
- Why: The motif returns changed: the same full glass, now gold.

**F07 Sunrise room** (was E1 reversed) | 221.8-231.8 s (10.0 s, frames 5323-5563) | **new**

- Script: (no line; end)
- Framing: top-down wide, A01's frame. Lens 18 mm, f/5.6. Location: room (ceiling pulled). Light: sunrise.
- Camera: from (2.15, 2.4, 3.2) to (2.25, 2.4, 3.45); look-at (0.85, 2.4, 0.35) -> (0.85, 2.4, 0.35). Move: slow rise 0.27 m (A01 in reverse).
- Focus: deep [(1.2, 2.4, 0.5)]
- Ivan: Ivan small in the chair turned to the window, not moving.
- Screen: screens still on
- Props: window pattern of sun across the bed (plan_topdown look); fade to black 229.8-231.8
- Board: ref plan_topdown.jpg + ref 05 panel 1 (gap fill)
- Why: Bookend: the room from above again, full of light now, and he has nowhere to go.

## 5. Build list (new assets and systems, by priority)

P1 items block the most shots. Build them first.

| # | Item | What it is | Shots | Notes |
|---|---|---|---|---|
| 1 | **Time-of-day bakes for room03:** `day`, `evening` (dusk), `sunrise` | Cycles lightmap sets for the new room:<br>- sunrise needs a low sun straight through the window, with mullion and blind shadows;<br>- the flashback day is warm, as in board A;<br>- plus the live `4am` preset and the `4am_iso` group scaling. | B01–B07, C00–C04, F01–F07, E01–E10 (4am) | The `engine/assets/lighting/day|evening|sunrise` sets that exist are for the **old flat**. Re-bake with `export_engine.py --preset ... --lm-only` against `set_room03`. Decide the window direction first (open question 3). |
| 2 | **Ivan's new performances** (`acting.py`, added, not rewritten) | 1. Reclined in the chair, phone held up, thumb-typing (B02–B06).<br>2. Sitting back with hands off the keys, watching (A08).<br>3. A finger on Y/Enter (A09, E07).<br>4. Standing at the window with a mug (D01). This needs a standing new Ivan; s02's `ivan_stand.glb` is the old Ivan.<br>5. Sip, drain and put down the mug (D03, D04).<br>6. Mug tremor at 8–10 Hz, 3–5 mm (E03).<br>7. Stop typing, shoulders rise (E04).<br>8. Sit up, proud nods (E10).<br>9. Push back, swivel ~130°, lean back with hands behind the head (F04, reuses the S5 curve).<br>10. Standing breath and one step in the void (V01–V03). | 30+ | Check the hands every time: no fingers in the face or glasses, no flipped wrists. |
| 3 | **Eye and lid controls** (a minimal face rig) | Blink, squeeze shut, widen, a sideways glance, and a small smile or "o" mouth. | C02, C06, E02, E05, E09, F05, V04, B04 | Ivan's rig is **locked**, so this needs approval. s02 notes "no facial rig yet". The fallback is eyes (look-at) and head only, which loses C02, E02 and C06's smile. |
| 4 | **Floating UI cards in 3D** | Emissive, camera-facing cards that live in room space (parallax, depth of field, bloom):<br>- the chat card (B02, B05);<br>- pipeline cards with a gear (C01);<br>- module icons (calendar, clock, documents, research) that pop in 6–12 frames (C03). | B02, B05, C01, C03 | Drawn on canvases like `screens.js`. |
| 5 | **The void stage** | A black stage with:<br>- the standing new Ivan;<br>- a light-streak and bokeh emitter (red, orange, peach, cyan) that moves at different speeds in front of and behind him;<br>- the streak tunnel and a vanishing point;<br>- the door of light (a 2.2 m slot) and a bloom to white;<br>- the ghost doubles (port `vibrate()` from s02). | V01–V03 | Use the existing `LOOK` and depth of field so the bokeh is real lens blur, not a new post pass. |
| 6 | **Screen content for Ch 1** (`screens.js` style canvases) | 1. Claude streaming code by itself (A08).<br>2. y/n prompts (A09, D05).<br>3. Phone UI: lock screen with Sarah's texts, Mail 412 badge, the Claude chat on the phone (A02, B03, B06, D02).<br>4. The "Sent ✓" flurry (D02).<br>5. The tests-pass flood (E08).<br>6. An "hours saved" counter (E06).<br>7. Dashboard tiles ticking on the words (F03).<br>8. Port of s02's `todo()` (C05).<br>9. **Monitor 2 as a live canvas** (it is static code today) (D05). | many | Text must be readable at 50–85 mm through bloom: use s02's 30 px rule. |
| 7 | **Glasses lens reflections** | The lens material reflects the current screen canvas (code lines, green cards, streaks), scrolled and mirrored. | C02, E02, E05, V04 (A05 benefits) | This touches Ivan's material, which is locked: needs approval. Could be an extra overlay mesh on the lens instead of changing the material. |
| 8 | **Phone on the bed** | The phone moves from the desk to the duvet:<br>- the screen wakes;<br>- a small live area light so it lights the duvet;<br>- a 0.4 s buzz (2 mm jitter);<br>- it dims after 4 s. | A02, D02, D06 | Also re-stages E2. |
| 9 | **Claude sprite** | The small glowing yellow character from board A r3c1: it pops out of the phone, bobs, and fades into the reply. | B04 (optionally B05) | The design is an open question. |
| 10 | **Mug in hand and coffee** | The mug parented to the hand, with a coffee surface ripple and one spill drop. | D01, D03, D04, E03 | |
| 11 | **Alarm-clock hands** | Port s02's `drawClock` overlay to `alarm_clock_01` on the nightstand (0.22, 0.80, 0.70). | C07 | Check that the asset's face is analogue and which way it faces (rot 60°). |
| 12 | **Chair swivel and recline** | The chair rotates and reclines with Ivan's root. | B02–B06, F04–F07 | |
| 13 | **Day dressing state** | Desk props by time:<br>- day: clean, one fresh mug, no glass poured;<br>- the mug count grows 1 → 3 → 4;<br>- the takeaway is hidden in the day. | B01–B07, C04, F02 | Prop visibility keyed by time, as in s02's `props()`. |
| 14 | **Window exterior face** | The wall, frame and glass seen from outside at 0.7 m, with the city reflected in the glass. | D01 | Fallback: camera inside at (1.40, 3.20, 1.50). |
| 15 | **"Thinness" effect** | The city bokeh behind him stretches into thin horizontal lines from 129.4 s. | D03 | **Prefer in-scene:** swap the far city lights for emissive streak cards. A post effect would touch the locked `post.js`. |
| 16 | **Bloodshot sclera and under-eye variant** | A 4 AM material state. | E02, E05 | Ivan's materials are locked: needs approval. |
| 17 | **Haze and sun shafts** | Already open in PLAN.md: shafts through the window at sunrise. | F01–F07, C00 | Adds `atmosphere.js` volume for the window. |
| 18 | Port the **sticky note** REVIEW + APPROVE | s02 code; NOTE moved by OFF to (1.12, 4.489, 0.925). | B07 | |
| 19 | Optional: **hand-lettered label** | "EMAIL AUTOMATION SYSTEM" with a pointer (board A r2c1). | A07 | Only if the director wants board-style annotations in the film. |
| 20 | **Engine:** one Ch 1 scene module | 51 shots, the light keys and per-shot props.<br>- The void is a second set inside the same timeline (or a sub-scene).<br>- The time-lapse uses an `atmoTime` and acting speed-up (s02 pattern). | all | |

## 6. Open questions for the director

1. **Voiceover.**
   - Are Ivan's typed line and Claude's reply voiced (Claude "in a typical agent tone"), or on screen only? The timing assumes both are voiced and also on screen.
   - Is the intro's existing VO reused for lines 1–6, or is all of Ch 1 re-recorded?
   - Keep "fucking" in the read and on screen?
2. **"On the couch" → the bed.** The proposal puts the phone on the duvet all night, and re-stages the intro's E2 there too. OK? Or keep the phone on the desk as board C r1c2 drew it?
3. **The window faces east** (story label only, no geometry change), so the sunrise comes through it. PLAN.md calls it west. OK?
4. **The flashback is set in the reclined desk chair with the phone** (board A), not typing at the laptop. OK? Is the floating chat card (board A r2c4) part of the film's language, along with the floating pipeline cards and icons on board B?
5. **The yellow sprite** (board A r3c1): is it Claude's recurring visual persona? A design is needed: shape, glow, how it moves, whether it comes back in Ch 2–3.
6. **The void:**
   - Should "everyone around him" appear as dim, slow grey figures in the far bokeh? The boards show only Ivan.
   - Should the door be a literal door-shaped slot of light (proposed) or stay abstract?
7. **Face rig:** may we add blink, squeeze, widen and smile controls to the locked Ivan? Or keep eyes and head only?
8. **Locked materials:** may we add a 4 AM bloodshot and under-eye variant, and a lens reflection overlay?
9. **The ending:**
   - The script keeps him in the chair. We added the swivel to face the sun (needed for board C r4c4's light) and closed on the top-down mirror of the opening (F07).
   - Alternative: he ends lying on the bed, eyes open, as in `ref/plan_topdown.jpg` and ref 05 panel 1. Which?
10. **The intro scene itself:** does the standalone intro also lose "Not because anyone asked him to / Because he realized he could" and S5/S5a? Ch 1 assumes yes.
11. **The 4 AM lamp:** dimmed (proposed ×0.6) or switched off?
12. **The "thinness" stretch** (D03): in-scene streak cards (proposed) or a keyed post effect? The post effect would touch the locked `post.js`.
13. **A01 lens:** E1 runs at 17–18 mm today. The plan raises it to 18–19 mm to keep inside the 18–100 mm rule. OK?

## 7. Not checked yet

**No frames have been rendered for this plan.** All camera positions are estimates from:
- `set_room03.py`;
- the marks in `room/lights.json`;
- the intro and s02 coordinates moved by OFF.

**Before building, capture one frame per new shot.** Command:

```
node tools/capture.mjs --extra scene=s03 --at <t> ...
```

Check each frame for:
1. collisions: the guitar near F04, Monitor 2 near D03, the bookshelf near A08;
2. headroom in the 2.0:1 letterbox;
3. whether the window and bed stay in frame where the cards say they do.

**Shot lengths** are not snapped to whole frames yet. Snap them when the timing is locked to the VO.

**Not judged:** real-time playback and audio sync.
