# Guide for the visual-building Claude: Chapter 1 audio -> video

You are receiving the audio package for **Chapter 1 ('The Binge')** of Swastik's cinematic story about Ivan and Claude. Your job: lay this audio under the picture, and make the picture hit the audio, not the other way round. **The voiceover is the clock.** Re-time the picture to the VO; never stretch or cut the VO to fit the picture.

## 0. Read this first

- Timings below are based on **PLANNED durations (ElevenLabs-reported clip lengths; may drift a few frames when the real files are measured)**.
- **STATUS: the VO audio files are not in this package yet.** ElevenLabs generated all 72 takes (36 beats x take A/B) in the flow linked in `02_VOICEOVER/vo_script_ch1.md`, but the sandbox that built this package could not download them (its network policy blocks the ElevenLabs file host). Once the clips are placed in `02_VOICEOVER/clips_DROP_HERE/` (`V01_A.mp3`, `V01_B.mp3` ...), run the two commands in section 3 and the VO master, the role stems and an exactly re-timed sound design are built automatically. Everything below stays valid; only times shift by the clip-length difference.
- Frame numbers assume **24 fps** (the reference clip `Ch01-Scene01.mp4` is 1920x1080, 24 fps). frame = round(seconds x 24). Change `FPS` in `tools/make_guide.py` and re-run if your project differs.
- Chapter audio runs **200.26 s**: **3.0 s pre-roll** of room tone before the first word, then 36 VO beats, then a **6.0 s tail** (the hook chime rings out, then silence). Picture should start at t=0 with the audio.
- Audio format: 48 kHz, 24-bit stereo WAV. VO is centered (mono in stereo). Everything is aligned to t=0 of the chapter.

## 1. What is in the package

| Folder | Contents | You use it for |
|---|---|---|
| `02_VOICEOVER/master/` | `ch01_vo_master.wav` (all voices), plus `ch01_vo_narrator.wav`, `ch01_vo_ivan.wav`, `ch01_vo_claude.wav` full-length aligned stems | the dialogue track; stems let you ride one voice |
| `02_VOICEOVER/processed_beats/` | each beat `V01.wav`...`V30b.wav`, processed and loudness matched | per-line placement, re-timing a single line |
| `03_SOUND_DESIGN/mixes/` | `ch01_sound_design_noVO` (.flac in the zip, lossless 24-bit; `render_mix.py` writes .wav) (the score + FX, already ducked for VO) and, after the build, `ch01_FULL_mix_VO_plus_sound.wav` | **the file you actually mux under the video** (the FULL mix) |
| `03_SOUND_DESIGN/buses/` | (.flac in the zip, same note) `bus_1_ambience`, `bus_2_music`, `bus_3_ui_digital`, `bus_4_foley`, `bus_5_hits_transitions` full-length, sample-aligned; they sum to the no-VO master | rebalance by scene, mute a family, export music-free versions |
| `03_SOUND_DESIGN/stems/<category>/` | 59 individual sounds (ambience, music_drones, ui_digital, designed_sfx, foley, impacts, transitions), every one on its own | if you need to move or re-trigger a single sound |
| `03_SOUND_DESIGN/cue_sheet.csv/.json` | all 98 cues with start/end seconds, gain, pan, bus, and why | the map between sound and picture |
| `04_TIMELINE/` | `timeline.json` (beat start/end), `ch01_vo_captions.srt`, `ch01_vo_markers.csv`, `ch01_timeline.png` | cut points, captions, overview |
| `tools/` | `build_vo.py`, `render_mix.py`, `make_manifest.py`, `make_guide.py`, generators | rebuilding after real clips arrive or after a re-time |

## 2. How the sound is designed (so your picture can speak the same language)

**Concept: organic -> digital drift.** Chapter 1 begins in a small, human, physical world (room tone, a fridge, a chair, a glass of water, fingers on keys). As Claude takes more of the work, the world acquires a digital layer (UI ticks, data pings, a pulse). The chapter ends *hollow*: the human sounds are gone and one digital sound (Claude's chime) remains, drowned in empty room.

- **Claude's motif** is a rising perfect fifth, E5 -> B5, bell-soft. Friendly in the flashback (V10), a shade colder when Ivan claims credit (after V27), hollow at the chapter-out hook (end of V30b). Treat it as Claude's *face*: it should be visible on screen as a soft glow / UI bloom when it sounds.
- **Module pings** are D-minor pentatonic (D5 F5 A5 C6). Ping a/b/c/d = Calendar / Scheduler / Docs / Research in V13a-d. Light each module on its own ping, not before it.
- **The pulse** (132 bpm tonal arp) is Ivan's 'vibrating at a different frequency': it starts in V12, peaks V15-V17, and is *cut dead* at the vacuum drop at the end of V17.
- **Silence is part of the design.** The room tone dips to near silence at V17->V18 (the cost), the pride is chopped at the end of V27, and the last line is followed by a full-glass shot and black. Do not fill these holds with extra motion or music.
- **Bold beats** (starred below) each own a deliberate hit. Land the visual accent on the hit frame; the VO line does the emotional work, the hit just underlines it.
- Sound is modern-technical: subtle UI/electronic tones, mechanical textures, controlled tonal impacts. No stock whooshes, no riser-hit cliches. If you feel the urge to add a whoosh on a cut, add nothing instead, or use a cut-synced tick from `stems/ui_digital`.

## 3. Build commands

```bash
cd tools
# 1) after dropping clips into ../02_VOICEOVER/clips_DROP_HERE/
#    (optional) ../02_VOICEOVER/choices.json  e.g. {"V09":"B","V15":"B"} to use take B on those beats
python3 build_vo.py                      # measures real clip lengths, re-times timeline.json, processes + places every beat
# 2) re-time the sound design to the new timeline and make the full mix (VO + sound, -16 LUFS, <= -1.5 dBFS peak)
python3 render_mix.py --vo ../02_VOICEOVER/master/ch01_vo_master.wav
# 3) refresh this guide's tables with the real timings
python3 make_guide.py
```

Mux onto the finished video **without touching the picture**:

```bash
ffmpeg -i ch01_picture.mp4 -i 03_SOUND_DESIGN/mixes/ch01_FULL_mix_VO_plus_sound.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest ch01_final.mp4
```

If the picture and the audio lengths differ by more than ~1 s, do not use `-shortest`: fix the picture (see section 6).

## 4. Scene map

| Scene | Starts | Ends | Beats | Mood / what the picture should feel like |
|---|---|---|---|---|
| S1 - 3 AM, the desk (present) | 00:03.00 (f72) | 00:36.96 (f887) | V01-V07b | Cold, close, oppressive. Warm lamp vs cold screen glow (as in the reference clip). A wall clock ticks. The stillness of the water glass is the first joke and the first wound. |
| S2 - Flashback, two days earlier | 00:38.56 (f925) | 01:07.28 (f1615) | V08-V11 | Daylight, brighter, airy: the *before*. Ivan is tired but hopeful; Claude arrives kind and bright. Sound is lighter and more open than S1. |
| S3 - The cheat code | 01:08.28 (f1639) | 01:44.49 (f2508) | V12-V17 | Acceleration. Modules light up on pings; the pulse builds; time compresses (V14a). V15 is the high, V17 the doorway of light, then it is cut. |
| S4 - The cost | 01:46.69 (f2561) | 02:14.46 (f3227) | V18-V23 | The cost. The world empties after the vacuum cut; unanswered phone; auto-replies to everyone else; fraying edges; one more module. Drone and heartbeat return. |
| S5 - 4 AM dread | 02:16.06 (f3265) | 02:50.76 (f4098) | V24-V27 | 4 AM dread: shaking hands, code he can no longer parse, then a module passes and the dread dissolves into pride. V27 is the chapter's pivot. |
| S6 - Dawn | 02:52.56 (f4141) | 03:14.26 (f4662) | V28-V30b | Dawn. Hollow, wired, exhausted. Four systems idle. Empty desk, the full glass, cut to black on the last line, then Claude's hollow chime. |

## 5. Beat-by-beat sync sheet (what to show, when)

Starred beats are the **bold / impact** lines (inferred; the source script had no formatting). 'Hit' = the cue that should coincide with a visual accent.

| Beat | Role | Start | End | Frames | Line | Show |
|---|---|---|---|---|---|---|
| V01 | NAR | 3.00 | 7.32 | f72-f176 | It's 3 AM, and Ivan hasn't eaten since lunch. | Dark apartment, laptop glow, phone 3:04. |
| V02 | NAR | 8.02 | 11.94 | f192-f287 | There's a glass of water on his desk that he poured six hours ago. | Push in on the glass beside the laptop. |
| ★ V03 | NAR | 12.84 | 14.60 | f308-f350 | It's still full. | Hold on the untouched glass. |
| V04 | NAR | 15.70 | 20.50 | f377-f492 | He's hunched over his laptop, typing furiously, eyes bloodshot. | Ivan hunched, close on eyes and hands. |
| V05 | NAR | 21.00 | 26.04 | f504-f625 | A terminal window, a Claude chat, and a growing sprawl of Python scripts. | Screen: terminal, Claude chat, scripts. |
| V06 | NAR | 26.64 | 29.44 | f639-f707 | He's building an email automation system. | Pipeline graph: DRAFT, REVIEW, SEND going green. |
| V07a | NAR | 30.34 | 34.18 | f728-f820 | Well... technically, Claude is doing the building. | Ivan watching code write itself. |
| ★ V07b | NAR | 34.88 | 36.96 | f837-f887 | Ivan keeps saying yes. | Ivan's finger on Enter / Approve. |
| V08 | NAR | 38.56 | 40.88 | f925-f981 | It started two days ago. | Cut to same desk, daylight. |
| V09 | IVAN | 41.88 | 49.88 | f1005-f1197 | i have like 400 unread emails. every single one wants a reply. i'm fucking drowning here! | Ivan types into a new Claude chat. |
| V10 | CLAUDE | 50.78 | 62.38 | f1219-f1497 | That sounds genuinely exhausting - and you're definitely not alone! I can write a script that sorts your inbox and drafts the replies for you. You just review and approve. Want me to build one? | Claude's reply streams in on screen. |
| ★ V11 | NAR | 63.68 | 67.28 | f1528-f1615 | That was the plan. Review and approve. | Return to present / smash back to the glowing screen. |
| V12 | NAR | 68.28 | 73.00 | f1639-f1752 | But once the email system was working, Ivan saw what else was possible. | Email system running; Ivan leans in. |
| V13a | NAR | 73.80 | 75.24 | f1771-f1806 | Calendar management. | Calendar module lights up. |
| V13b | NAR | 75.49 | 76.93 | f1812-f1846 | Meeting scheduling. | Scheduler module lights up. |
| V13c | NAR | 77.18 | 78.86 | f1852-f1893 | Document drafting. | Docs module lights up. |
| V13d | NAR | 79.11 | 80.63 | f1899-f1935 | Research summaries. | Research module lights up. |
| V14a | NAR | 81.33 | 84.29 | f1952-f2023 | Each one a few hours of coding. | Hours of code compress. |
| V14b | NAR | 84.64 | 88.48 | f2031-f2124 | Each one removing another task from his daily routine. | Tasks disappearing from his day. |
| ★ V15 | NAR | 89.48 | 92.92 | f2148-f2230 | It's like discovering a cheat code for life. | Ivan's face lit up; the world opens. |
| V16 | NAR | 93.27 | 96.31 | f2238-f2311 | Every problem that used to take hours now takes minutes. | Montage of problems resolving. |
| V17 | NAR | 96.81 | 104.49 | f2323-f2508 | Ivan feels like he's vibrating at a different frequency than everyone around him, like he's stepped through a door that others can't even see. | Ivan separate from the world; a doorway of light. |
| V18 | NAR | 106.69 | 111.49 | f2561-f2676 | He's barely slept. His girlfriend stopped texting because he wasn't responding. | Phone lights up on the couch, unanswered. |
| V19 | NAR | 112.09 | 116.01 | f2690-f2784 | Ironic, given that his system now responds to everyone else. | Auto-replies going out to everyone. |
| V20 | NAR | 117.01 | 124.69 | f2808-f2993 | He knows this isn't healthy. He can feel something fraying at the edges of his mind, a thinness to his thoughts. | Ivan staring at nothing; the edges of the frame soften. |
| V21 | NAR | 125.59 | 128.07 | f3014-f3074 | But he's close to something. | Back to the screen. |
| V22 | IVAN | 128.67 | 132.03 | f3088-f3169 | One more module. One more integration. | Fingers back on keys. |
| V23 | NAR | 132.38 | 134.46 | f3177-f3227 | Then he'll rest. | Close on tired eyes. |
| V24 | NAR | 136.06 | 145.66 | f3265-f3496 | It's not all pleasant. Around 4 AM, when his eyes burn and his hands shake from a caffeine overload, Ivan feels a creeping dread. | 4 AM; shaking hands; coffee. |
| V25 | NAR | 146.56 | 156.16 | f3517-f3748 | A sense that he's building something he doesn't fully understand. That each automation takes something from him, even as it gives something back. | Code he can no longer parse. |
| V26 | NAR | 157.16 | 163.96 | f3772-f3935 | But then he finishes another module, and it works, and the dread dissolves into a rush of pure satisfaction. | Tests pass; green. |
| ★ V27 | IVAN | 164.76 | 170.76 | f3954-f4098 | HE... built that. The machine does what HE told it to do. | Ivan's face, lit by green. |
| V28 | NAR | 172.56 | 180.80 | f4141-f4339 | By sunrise, Ivan has a system that handles his email, manages his calendar, drafts his documents, and summarizes his reading. | Dawn at the window; four systems idle. |
| V29 | NAR | 181.50 | 186.38 | f4356-f4473 | He leans back in his chair, exhausted and wired. | Ivan leans back. |
| V30a | NAR | 187.78 | 189.78 | f4507-f4555 | Then he realizes... | Close on his face. |
| ★ V30b | NAR | 191.38 | 194.26 | f4593-f4662 | he doesn't know what he's supposed to do now. | Empty desk, full glass of water, cut to black. |

### Bold-beat hit frames

| Beat | Hit cue | Time | Frame | Sound | Visual accent to land on it |
|---|---|---|---|---|---|
| V03 | `V03_drop` | 12.79 | f307 | `imp_sub_drop_soft.wav` | hard hold on the untouched glass; let the frame stop breathing |
| V07b | `V07b_hit` | 35.98 | f864 | `imp_tonal_hit_minor2.wav` | finger presses Enter / Approve; one tiny recoil in the screen glow |
| V11 | `V11_drop` | 63.68 | f1528 | `imp_sub_drop_soft.wav` | smash back to the glowing present; screen light hits his face |
| V15 | `V15_rush` | 89.83 | f2156 | `ui_module_complete_rush.wav` | his face lights up; first and only wide, warm, open frame of the chapter |
| V27 | `V27_hit` | 164.81 | f3955 | `imp_tonal_hit_minor2.wav` | face lit by green; hold on 'HE', then a slower push on the second HE |
| V27 | `V27_drop` | 167.64 | f4023 | `imp_sub_drop_soft.wav` | face lit by green; hold on 'HE', then a slower push on the second HE |
| V30 | `V30_hook` | 194.66 | f4672 | `ui_claude_chime_hollow.wav` | last chime rings over black |

## 6. Rules for combining audio and picture

1. **Cut to the voice.** Cuts land 0-6 frames *before* the stressed word, never after it. If the picture is already built, re-time it to the VO (remove/repeat static hold frames, shorten creeping settles) instead of re-cutting; keep untouched frames bit-identical and verify (PSNR / md5) when re-timing a rendered clip.
2. **Gaps are breathing room, not dead air.** Gaps between beats are 0.25-2.2 s on purpose (list items V13a-d are 0.25 s apart; V17->V18 is 2.2 s so the phone buzz fits). Fill them with the picture's slow move, not with extra sound.
3. **Do not add sound on top.** The cue sheet is the whole score. If something in the picture needs a sound that is not there, pick it from `stems/` (all individually named) and place it on a new track *above* the full mix at -10 dB or lower. Never use stock whoosh/riser/hit libraries.
4. **Levels.** VO is about -19 LUFS before the mix (Ivan -21 inner, Claude -20, bold Ivan -19.5). The sound-design master is about -29 LUFS (it is ducked 7-9 dB under any speech automatically). The FULL mix is normalised to -16 LUFS integrated, true peak <= -1.5 dBFS. Do not re-normalise individual stems.
5. **Do not time-stretch the VO or the sound design.** If a line must move, move the whole beat (and its cues move with it, as they are anchored to beat ids; re-run `render_mix.py --timeline`).
6. **Use the reference clip as the look, not the clock.** `Ch01-Scene01.mp4` is 37.0 s of picture with ~31 s of its own scratch VO. The new Scene 1 (S1) runs from the 3 s pre-roll to the end of V07b, so its picture needs to be re-timed to the new VO. The dark CG look, wall clock, warm lamp vs cold screen glow and the DRAFT -> REVIEW -> SEND pipeline graph are all right and should be kept.
7. **Captions** (if used): `04_TIMELINE/ch01_vo_captions.srt` uses the same clock as the audio.

## 7. Sound events that need an on-screen counterpart

These are the cues where an audio event implies something visible. Make the picture do it **at that frame** (+/- 2 frames):

| Time | Frame | Cue | Sound | What should be visible |
|---|---|---|---|---|
| 4.15 | f100 | `S1_phone_wake` | `ui_screen_wake_click` | phone screen wakes: 3:04 |
| 9.78 | f235 | `V02_glass` | `sfx_glass_stillness` | the untouched glass; swells through V03 |
| 12.79 | f307 | `V03_drop` | `imp_sub_drop_soft` | 'It's still full.' |
| 16.30 | f391 | `V04_type` | `fol_typing_burst_fast` | typing furiously |
| 21.80 | f523 | `V05_stream` | `ui_terminal_text_stream_long` | terminal scrolling |
| 23.77 | f571 | `V05_chat` | `ui_msg_receive_tick` | Claude chat |
| 27.56 | f662 | `V06_ping_a` | `ui_module_ping_a` | DRAFT green |
| 28.26 | f678 | `V06_ping_b` | `ui_module_ping_b` | REVIEW green |
| 28.64 | f687 | `V06_send` | `ui_pipeline_send_confirm` | pipeline complete |
| 28.96 | f695 | `V06_ping_c` | `ui_module_ping_c` | SEND green |
| 32.24 | f774 | `V07a_stream` | `ui_terminal_text_stream_short` | code writing itself |
| 32.26 | f774 | `V07a_chime` | `ui_claude_chime_friendly` | Claude's motif: 'Claude is doing the building' |
| 35.98 | f864 | `V07b_hit` | `imp_tonal_hit_minor2` | 'Ivan keeps saying yes.' |
| 36.36 | f873 | `T_flashback` | `trn_flashback_timeshift` | present -> two days ago |
| 42.18 | f1012 | `V09_type` | `fol_typing_burst_slow` | Ivan typing into a new chat |
| 50.63 | f1215 | `V10_chime` | `ui_claude_chime_friendly` | Claude's first entrance. Friendly, human-feeling |
| 51.38 | f1233 | `V10_stream_a` | `ui_terminal_text_stream_long` | reply streaming in |
| 63.68 | f1528 | `V11_drop` | `imp_sub_drop_soft` | 'That was the plan. Review and approve.'  Smash back to the present |
| 69.70 | f1673 | `V12_ok` | `ui_compile_success` | email system working |
| 73.85 | f1772 | `V13a_ping` | `ui_module_ping_a` | Calendar management lights up |
| 75.54 | f1813 | `V13b_ping` | `ui_module_ping_b` | Meeting scheduling |
| 77.23 | f1854 | `V13c_ping` | `ui_module_ping_c` | Document drafting |
| 79.16 | f1900 | `V13d_ping` | `ui_module_ping_d` | Research summaries |
| 81.13 | f1947 | `V14a_type` | `fol_typing_burst_fast` | hours of code... |
| 81.38 | f1953 | `V14a_skip` | `trn_time_skip_tick` | ...compress |
| 85.33 | f2048 | `V14b_pop1` | `ui_task_clear_pop` | tasks disappearing from his day |
| 86.75 | f2082 | `V14b_takegive` | `sfx_take_give` | takes something from him even as it gives |
| 89.83 | f2156 | `V15_rush` | `ui_module_complete_rush` | 'a cheat code for life': the rush |
| 95.41 | f2290 | `V16_ok` | `ui_compile_success` | problems resolving in minutes |
| 96.46 | f2315 | `V17_door` | `trn_door_threshold` | a doorway only Ivan can see |
| 97.26 | f2334 | `V17_vib` | `sfx_vibrating_frequency` | 'vibrating at a different frequency': swells then cut at the end of the line |
| 104.29 | f2503 | `T_vacuum` | `trn_vacuum_dropout` | the high is cut off: the world empties |
| 104.79 | f2515 | `V18_buzz` | `fol_phone_buzz_couch` | girlfriend's text, unanswered (lands before V18) |
| 114.25 | f2742 | `V19_flurry` | `ui_auto_reply_flurry` | 'his system now responds to everyone else' |
| 118.61 | f2847 | `V20_fray` | `sfx_fraying_texture` | 'something fraying at the edge' |
| 126.09 | f3026 | `V21_lean` | `fol_chair_creak_lean` | back to the screen |
| 128.37 | f3081 | `V22_type` | `fol_typing_burst_fast` | fingers back on keys |
| 133.76 | f3210 | `V23_breath` | `fol_breath_exhale` | 'Then he'll rest.' |
| 134.81 | f3235 | `T_timeskip` | `trn_time_skip_tick` | hours pass: 3 AM -> 4 AM |
| 141.34 | f3392 | `V24_tremor` | `sfx_caffeine_tremor` | 'his hands shake' |
| 146.96 | f3527 | `V25_stream` | `ui_terminal_text_stream_long` | code he can no longer parse |
| 152.51 | f3660 | `V25_fray` | `sfx_fraying_texture` | 'something he doesn't fully understand' |
| 158.52 | f3804 | `V26_ok` | `ui_compile_success` | module works: the dread dissolves |
| 162.06 | f3889 | `V26_send` | `ui_pipeline_send_confirm` | tests pass; green |
| 164.81 | f3955 | `V27_hit` | `imp_tonal_hit_minor2` | 'HE... built that.' |
| 167.64 | f4023 | `V27_drop` | `imp_sub_drop_soft` | 'what HE told it to do.' |
| 170.71 | f4097 | `T_vacuum2` | `trn_vacuum_dropout` | pride cut off |
| 171.81 | f4123 | `V27_chime` | `ui_claude_chime_neutral` | Claude's motif, one shade colder |
| 172.06 | f4129 | `T_dawn` | `trn_dawn_rise` | sunrise |
| 175.03 | f4201 | `V28_ping1` | `ui_module_ping_a` | four systems idle |
| 181.90 | f4366 | `V29_lean` | `fol_chair_creak_lean` | he leans back |
| 184.92 | f4438 | `V29_breath` | `fol_breath_exhale` | exhausted |
| 187.58 | f4502 | `V30_glass` | `sfx_glass_stillness` | the full glass, again. Swells to the last line |
| 194.15 | f4659 | `V30_vac` | `trn_vacuum_dropout` | cut to black |
| 194.66 | f4672 | `V30_hook` | `ui_claude_chime_hollow` | chapter-out hook: Claude's motif, hollowed out |

## 8. Full cue list (beds)

| Start | End | Cue | Stem | Bus | Gain dB | Note |
|---|---|---|---|---|---|---|
| 0.00 | 16.70 | `S1_city` | `amb_city_night_far.wav` | amb | -9 | the world outside, receding as we push in on Ivan |
| 0.00 | 37.76 | `S1_fridge` | `amb_fridge_cycle.wav` | amb | -13 | compressor cycle; its silence lands under 'still full' |
| 0.00 | 38.16 | `S1_room` | `amb_room_tone_3am.wav` | amb | -3 | oppressive room tone, starts the chapter |
| 3.60 | 37.76 | `S1_drone` | `mus_drone_isolation.wav` | music | -12 | isolation drone |
| 4.00 | 37.96 | `S1_fan` | `amb_laptop_fan.wav` | amb | -12 | laptop working hard |
| 15.70 | 37.76 | `S1_clock` | `fol_wall_clock_tick.wav` | amb | -8 | wall clock (seen in the reference clip) |
| 38.06 | 63.78 | `S2_daylight` | `amb_daylight_room.wav` | amb | -3 | flashback room tone (daylight) |
| 50.28 | 63.58 | `S2_wonder` | `mus_wonder_pad.wav` | music | -10 | 'it's working' glow under Claude's reply |
| 63.48 | 170.76 | `S3_room` | `amb_room_tone_3am.wav` | amb | -3 | present-day room tone for the rest of the night; dips to near-silence at the vacuum cut (V17->V18) |
| 63.68 | 170.76 | `S3_fan` | `amb_laptop_fan.wav` | amb | -12 |  |
| 70.50 | 86.70 | `S3_ramp` | `mus_pulse_ramp.wav` | music | -9 | nervous system warming up; peaks at the list items |
| 81.33 | 104.44 | `S3_hold` | `mus_pulse_hold.wav` | music | -10 | 132 bpm pulse = vibrating. Cut dead at the vacuum |
| 105.69 | 135.46 | `S4_drone` | `mus_drone_isolation.wav` | music | -11 | isolation returns |
| 118.51 | 134.96 | `S4_heart` | `fol_heartbeat_62bpm_loop.wav` | foley | -17 | body awareness: 62 bpm |
| 134.86 | 158.52 | `S5_dread` | `mus_dread_cluster.wav` | music | -8 | semitone cluster crawling up; dissolves when the module works |
| 134.96 | 164.96 | `S5_clock` | `fol_wall_clock_tick.wav` | amb | -3 | clock louder at 4 AM |
| 138.94 | 156.46 | `S5_heart` | `fol_heartbeat_ramp.wav` | foley | -14 | 62 -> 100 bpm |
| 158.25 | 170.76 | `S5_wonder` | `mus_wonder_pad.wav` | music | -8 | relief / pride glow, too bright, a little wrong |
| 171.96 | 198.00 | `S6_dawn` | `amb_dawn_hollow.wav` | amb | -5 | post-binge hollow: tinnitus-thin tone, exhausted and wired |
| 175.03 | 200.00 | `S6_music` | `mus_hollow_dawn.wav` | music | -8 | sparse bells in a big empty room |

## 9. QA checklist before you hand the video back

- [ ] Video and FULL mix have the same duration to within a frame; first frame = t=0 of the audio.
- [ ] V03 'It's still full.' lands with the hold on the glass; the glass is **full** in V03 and again in V30b (the same shot, deliberate echo).
- [ ] V11 smash-back hits on the screen light; V15 is the only warm, open frame; V17 ends exactly as the pulse is cut.
- [ ] The 4 modules (V13a-d) light on their own pings, in order: Calendar, Scheduler, Docs, Research.
- [ ] V27 'HE' is on a locked-off or very slow shot; nothing moves on the second 'HE' except the face.
- [ ] After V30b the last picture is black *before* the hollow chime; the chime tail rings to the end (6 s tail).
- [ ] `ffmpeg -i final.mp4 -af ebur128 -f null -` reports about -16 LUFS integrated and true peak <= -1.5 dBTP.
- [ ] Spot-check three timestamps in the final export by playing them: V03, V11, V27.

## 10. Known limits

- All sound design is generated procedurally (numpy/scipy), because the ElevenLabs connector used here cannot make music. It was checked by measurement (levels, loudness, spectrum, loop seams, clipping), not by ear: **listen once and tell Swastik what to change** (gain, which stems to drop).
- Voices were picked from ElevenLabs' descriptions; alternates are listed in `02_VOICEOVER/vo_script_ch1.md`.
- The bold-beat list is inferred. Word-level cues (e.g. 'HE' x2 in V27) are anchored by fraction of the clip, not by word timing; with the real clips, nudge `cues.py` offsets if a hit sits a few frames off the word and re-run `render_mix.py`.
