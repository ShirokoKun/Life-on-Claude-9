# Scene 4, "Two days ago": direction

The Chapter 1 flashback: VO beats **V08–V11**, chapter **36.96–68.28 s** (31.32 s, 752 frames at 24 fps).
- **Scene module:** `engine/scenes/s04/scene.js`. Open it in the Studio as scene 4, or at `engine/index.html?scene=s04`.
- **Set, look and live rig:** Ivan's room (s03), unchanged. `look.json` is a copy of s03's.
- **Performance:** `blender/characters/acting.py` `SCENE_S04` → `engine/scenes/s04/ivan.glb`.
- **Sound:** `engine/scenes/s04/sound.wav`, the package's no-VO sound design cut at 36.96–68.28.

**The clock:** the voiceover package (`audio/Ch01_VO_SoundPackage/04_TIMELINE/timeline.json`). Scene time 0 is chapter 36.96 s, the end of V07b, where scene 3 ends. Every time below is scene time, with chapter time in brackets.

## Where it sits in Chapter 1

The chapter is 200.26 s on the VO clock: 3.0 s of pre-roll, 36 beats, and a 6 s tail. It splits into one scene per sound-design scene.

| Scene | VO | Chapter time | Status |
|---|---|---|---|
| s03 Ivan's room ("3 AM") | V01–V07b | 0–36.96 | Exists, built on the intro's 37 s clock. Needs re-timing to the new VO (V01 starts at 3.0 s, not 6.0 s). |
| **s04 Two days ago** | V08–V11 | 36.96–68.28 | **This scene.** |
| s05 The cheat code | V12–V17 | 68.28–104.49 (+2.2 s vacuum gap) | Next. Plan shots C00–C07 and V01–V04 in `scenes/ch1/CHAPTER1_PLAN.md`. |
| s06 The cost | V18–V23 | 106.69–134.46 | Plan shots D01–D06. |
| s07 4 AM | V24–V27 | 136.06–170.76 | Plan shots E01–E10. |
| s08 Dawn | V28–V30b | 172.56–200.26 | Plan shots F01–F07. |

`scenes/ch1/CHAPTER1_PLAN.md` is still the shot bible; its times are estimates from before the VO existed. Each new scene takes its cards and re-times them to the VO clock, as this one does.

## The beat

- **Feeling:** frazzled, then relief.
- **What changes:** a normal guy with a bad inbox day gets a friendly offer and says yes.
- **The turn:** V11, the smash back to 3 AM. The sound design already cuts there: S2's daylight room tone ends at 63.78, the 3 AM room tone returns at 63.48, and the sub drop lands at 63.68.

**Colour rule (style bible):** blue is the machine, amber is the human. The flashback is the one stretch where the whole room is warm. That makes the cut back to blue at V11 hurt.

## Shots

| # | Shot | Time | Lens | Camera | Ivan | What it says |
|---|---|---|---|---|---|---|
| B01 | Two days ago | 0–4.92 (36.96–41.88) | 24 mm f/4 | Locked wide from the door wall, 4 cm drift. Window left, desk right. | Night hunch; he straightens up as the light reverses (1.0–3.6), types, then scrolls the inbox. | The light runs backwards (3 AM → day over 0.6–3.6). The full glass disappears: he hasn't poured it yet. V08 "It started two days ago." |
| B02 | Drowning | 4.92–10.0 (41.88–46.96) | 35 mm f/2 | Low from the desk end; the day window behind him; aim follows his posture. | Leans in and types the first sentence (5.1–8.5). Shoves back, hands behind his head, eyes to the ceiling (8.6–10.0). | V09a "i have like 400 unread emails…": a normal guy having a bad day. |
| B03 | Send | 10.0–13.5 (46.96–50.46) | 50 mm f/2 | Over his right shoulder onto the laptop. | Snaps forward, types hard (10.4–12.8), Enter at 13.0. | V09b "i'm fucking drowning here!" typed into a new Claude chat over the 412-unread inbox. |
| B04 | Hello, Claude | 13.5–18.6 (50.46–55.56) | 40 mm f/2.2 | Profile two-shot from his right (board A r3c1). | Sits back on the chime (13.4–13.9), looks up at the spark (13.6–15.4), a short laugh breath (14.3–15.2), then reads. | Claude's chime (13.67, cue `V10_chime`): the spark rises out of the laptop. Focus eyes → spark → eyes. V10a "That sounds genuinely exhausting…" |
| B05 | The offer | 18.6–23.0 (55.56–59.96) | 30 mm f/2 | Behind his right shoulder onto the floating chat card (board A r2c4, "complaining to claude"). | Reads; a nod on "drafts the replies for you" (21.4–22.2). | The spark drifts into the card (17.8–18.6). The pipeline sketch draws itself: inbox → sort → draft → you. V10b "I can write a script…" |
| B06 | yes | 23.0–26.72 (59.96–63.68) | 60 mm f/2.8 | Low from the right over the keyboard: the night's "saying yes" frame, in daylight. | Hands back on the keys (24.9–25.4), y-e-s (25.7–26.15), Enter (26.3). | V10c "You just review and approve. Want me to build one?" The first yes. |
| B07 | The plan | 26.72–31.32 (63.68–68.28) | 70 mm f/2 | Behind the laptop (wild north wall). Creeping push; the aim tilts from the note up to his face. | Hunched at 3 AM again, typing. | Smash cut on the sub drop (`V11_drop`). REVIEW + APPROVE on the back of the lid. Focus holds the note through "Review and approve", then slips to his face (29.9–30.7). He never looks at it. |

**Pacing:** 7 shots in 31.3 s, which is 13.4 shots/min (the chapter plan's average is 13.2). The median shot is 4.6 s; the longest is B02 at 5.1 s.

**Rule:** cuts land on the voice. B03 cuts in as he lunges forward, B04 just before the chime, and B07 on the drop.

**Recurring devices:**
- **Floating chat card** (B03 on, out at the smash cut). Turn it off with `?card=0`.
- **Claude's spark** (13.67–18.6), with a small warm light on his face.
- **Glass:** hidden in the afternoon.
- **Sticky note:** seen only at 3 AM.

## Sound under it (no-VO mix, already in `sound.wav`)

| Scene t | Chapter t | Cue | Picture |
|---|---|---|---|
| 1.10 (from 38.06) | 38.06 | `S2_daylight` room tone in | light reversing (B01) |
| 5.22 | 42.18 | `V09_type` slow typing burst | he types (B02) |
| 13.30 | 50.26 | `S2_wonder` pad in | before the chime |
| 13.67 | 50.63 | `V10_chime` Claude, friendly | the spark pops (B04) |
| 14.42 | 51.38 | `V10_stream_a` | the reply streams |
| 26.52 / 26.72 | 63.48 / 63.68 | `S3_room` 3 AM tone back / `V11_drop` | smash cut (B07) |

## Open (needs you, or the next session)

1. **Daylight bake.**
   - `engine/scenes/s03/lighting/` is empty, so "day" falls back to the 3 AM lightmaps. B01–B06 then read as night with the lamps off.
   - Bake it (GPU, after a render finishes):

     ```bash
     blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/lighting/day --bake --preset day --lm-only
     ```

   - The same goes for `evening` and `sunrise`, which s05 (dusk) and s08 (dawn) need.
2. **Real VO clips.** The package has no voice audio; ElevenLabs blocked the download.
   - Drop the takes into `audio/Ch01_VO_SoundPackage/02_VOICEOVER/clips_DROP_HERE/`.
   - Run `build_vo.py` and `render_mix.py`.
   - Re-cut `sound.wav` from `ch01_FULL_mix_VO_plus_sound.wav` at 36.96–68.28.
   - Re-lock the V09 and V10 sentence splits, which are estimates (`CAPTIONS`, `MAP` in `scene.js`, and `SCENE_S04` keys).
3. **Phone vs laptop.**
   - Board A draws him reclined with the phone.
   - This pass keeps him at the laptop: the script says "Ivan opens a new chat… IVAN (typing)", and a phone-in-hand performance doesn't exist yet.
   - The floating card carries the board's look. If you want the phone, it is a new `acting.py` channel (right hand up, thumb taps).
4. **The spark's design.** For now it is a warm 10-ray starburst. Is it Claude's recurring face? It should be the one look used for every chime the guide asks for (V07a, V10, V27, V30).
5. **Hand-letter label** "EMAIL AUTOMATION SYSTEM" (board A r2c1): s03's A07, not this scene.
