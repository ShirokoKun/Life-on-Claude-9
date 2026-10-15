"""Regenerates 01_GUIDE/GUIDE_FOR_VISUAL_CLAUDE.md. Tables (scene map, bold-beat sync points, cue list) come straight from
timeline.json / cue_sheet.json, so re-run it after build_vo.py + render_mix.py to get tables with the REAL timings."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
R = os.path.join(HERE, "..")
T = json.load(open(R + "/04_TIMELINE/timeline.json")); S = json.load(open(R + "/03_SOUND_DESIGN/cue_sheet.json"))
M = json.load(open(R + "/02_VOICEOVER/vo_manifest.json")); FPS = 24
have_vo = os.path.exists(R + "/02_VOICEOVER/master/ch01_vo_master.wav")
tl = {b["id"]: b for b in T["beats"]}; mb = {b["id"]: b for b in M["beats"]}
fr = lambda t: int(round(t * FPS))
tc = lambda t: f"{int(t//60):02d}:{t%60:05.2f}"
planned = "REAL clip durations" if have_vo else "PLANNED durations (ElevenLabs-reported clip lengths; may drift a few frames when the real files are measured)"

L = []
w = L.append
w("# Guide for the visual-building Claude: Chapter 1 audio -> video\n")
w("You are receiving the audio package for **Chapter 1 ('The Binge')** of Swastik's cinematic story about Ivan and Claude. Your job: lay this audio under the picture, and make the picture hit the audio, not the other way round. **The voiceover is the clock.** Re-time the picture to the VO; never stretch or cut the VO to fit the picture.\n")
w("## 0. Read this first\n")
w(f"- Timings below are based on **{planned}**.")
if not have_vo:
    w("- **STATUS: the VO audio files are not in this package yet.** ElevenLabs generated all 72 takes (36 beats x take A/B) in the flow linked in `02_VOICEOVER/vo_script_ch1.md`, but the sandbox that built this package could not download them (its network policy blocks the ElevenLabs file host). Once the clips are placed in `02_VOICEOVER/clips_DROP_HERE/` (`V01_A.mp3`, `V01_B.mp3` ...), run the two commands in section 3 and the VO master, the role stems and an exactly re-timed sound design are built automatically. Everything below stays valid; only times shift by the clip-length difference.")
w("- Frame numbers assume **24 fps** (the reference clip `Ch01-Scene01.mp4` is 1920x1080, 24 fps). frame = round(seconds x 24). Change `FPS` in `tools/make_guide.py` and re-run if your project differs.")
w(f"- Chapter audio runs **{T['total_duration']:.2f} s**: **{T['pre_roll']:.1f} s pre-roll** of room tone before the first word, then 36 VO beats, then a **{T['tail']:.1f} s tail** (the hook chime rings out, then silence). Picture should start at t=0 with the audio.")
w("- Audio format: 48 kHz, 24-bit stereo WAV. VO is centered (mono in stereo). Everything is aligned to t=0 of the chapter.\n")
w("## 1. What is in the package\n")
w("| Folder | Contents | You use it for |\n|---|---|---|")
w("| `02_VOICEOVER/master/` | `ch01_vo_master.wav` (all voices), plus `ch01_vo_narrator.wav`, `ch01_vo_ivan.wav`, `ch01_vo_claude.wav` full-length aligned stems | the dialogue track; stems let you ride one voice |")
w("| `02_VOICEOVER/processed_beats/` | each beat `V01.wav`...`V30b.wav`, processed and loudness matched | per-line placement, re-timing a single line |")
w("| `03_SOUND_DESIGN/mixes/` | `ch01_sound_design_noVO` (.flac in the zip, lossless 24-bit; `render_mix.py` writes .wav) (the score + FX, already ducked for VO) and, after the build, `ch01_FULL_mix_VO_plus_sound.wav` | **the file you actually mux under the video** (the FULL mix) |")
w("| `03_SOUND_DESIGN/buses/` | (.flac in the zip, same note) `bus_1_ambience`, `bus_2_music`, `bus_3_ui_digital`, `bus_4_foley`, `bus_5_hits_transitions` full-length, sample-aligned; they sum to the no-VO master | rebalance by scene, mute a family, export music-free versions |")
w("| `03_SOUND_DESIGN/stems/<category>/` | 59 individual sounds (ambience, music_drones, ui_digital, designed_sfx, foley, impacts, transitions), every one on its own | if you need to move or re-trigger a single sound |")
w("| `03_SOUND_DESIGN/cue_sheet.csv/.json` | all 98 cues with start/end seconds, gain, pan, bus, and why | the map between sound and picture |")
w("| `04_TIMELINE/` | `timeline.json` (beat start/end), `ch01_vo_captions.srt`, `ch01_vo_markers.csv`, `ch01_timeline.png` | cut points, captions, overview |")
w("| `tools/` | `build_vo.py`, `render_mix.py`, `make_manifest.py`, `make_guide.py`, generators | rebuilding after real clips arrive or after a re-time |\n")
w("## 2. How the sound is designed (so your picture can speak the same language)\n")
w("**Concept: organic -> digital drift.** Chapter 1 begins in a small, human, physical world (room tone, a fridge, a chair, a glass of water, fingers on keys). As Claude takes more of the work, the world acquires a digital layer (UI ticks, data pings, a pulse). The chapter ends *hollow*: the human sounds are gone and one digital sound (Claude's chime) remains, drowned in empty room.\n")
w("- **Claude's motif** is a rising perfect fifth, E5 -> B5, bell-soft. Friendly in the flashback (V10), a shade colder when Ivan claims credit (after V27), hollow at the chapter-out hook (end of V30b). Treat it as Claude's *face*: it should be visible on screen as a soft glow / UI bloom when it sounds.")
w("- **Module pings** are D-minor pentatonic (D5 F5 A5 C6). Ping a/b/c/d = Calendar / Scheduler / Docs / Research in V13a-d. Light each module on its own ping, not before it.")
w("- **The pulse** (132 bpm tonal arp) is Ivan's 'vibrating at a different frequency': it starts in V12, peaks V15-V17, and is *cut dead* at the vacuum drop at the end of V17.")
w("- **Silence is part of the design.** The room tone dips to near silence at V17->V18 (the cost), the pride is chopped at the end of V27, and the last line is followed by a full-glass shot and black. Do not fill these holds with extra motion or music.")
w("- **Bold beats** (starred below) each own a deliberate hit. Land the visual accent on the hit frame; the VO line does the emotional work, the hit just underlines it.")
w("- Sound is modern-technical: subtle UI/electronic tones, mechanical textures, controlled tonal impacts. No stock whooshes, no riser-hit cliches. If you feel the urge to add a whoosh on a cut, add nothing instead, or use a cut-synced tick from `stems/ui_digital`.\n")
w("## 3. Build commands\n")
w("```bash\ncd tools\n# 1) after dropping clips into ../02_VOICEOVER/clips_DROP_HERE/\n#    (optional) ../02_VOICEOVER/choices.json  e.g. {\"V09\":\"B\",\"V15\":\"B\"} to use take B on those beats\npython3 build_vo.py                      # measures real clip lengths, re-times timeline.json, processes + places every beat\n# 2) re-time the sound design to the new timeline and make the full mix (VO + sound, -16 LUFS, <= -1.5 dBFS peak)\npython3 render_mix.py --vo ../02_VOICEOVER/master/ch01_vo_master.wav\n# 3) refresh this guide's tables with the real timings\npython3 make_guide.py\n```\n")
w("Mux onto the finished video **without touching the picture**:\n")
w("```bash\nffmpeg -i ch01_picture.mp4 -i 03_SOUND_DESIGN/mixes/ch01_FULL_mix_VO_plus_sound.wav \\\n  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest ch01_final.mp4\n```\n")
w("If the picture and the audio lengths differ by more than ~1 s, do not use `-shortest`: fix the picture (see section 6).\n")
w("## 4. Scene map\n")
w("| Scene | Starts | Ends | Beats | Mood / what the picture should feel like |\n|---|---|---|---|---|")
mood = {"S1": "Cold, close, oppressive. Warm lamp vs cold screen glow (as in the reference clip). A wall clock ticks. The stillness of the water glass is the first joke and the first wound.",
        "S2": "Daylight, brighter, airy: the *before*. Ivan is tired but hopeful; Claude arrives kind and bright. Sound is lighter and more open than S1.",
        "S3": "Acceleration. Modules light up on pings; the pulse builds; time compresses (V14a). V15 is the high, V17 the doorway of light, then it is cut.",
        "S4": "The cost. The world empties after the vacuum cut; unanswered phone; auto-replies to everyone else; fraying edges; one more module. Drone and heartbeat return.",
        "S5": "4 AM dread: shaking hands, code he can no longer parse, then a module passes and the dread dissolves into pride. V27 is the chapter's pivot.",
        "S6": "Dawn. Hollow, wired, exhausted. Four systems idle. Empty desk, the full glass, cut to black on the last line, then Claude's hollow chime."}
scs = []
for b in T["beats"]:
    if b["scene"] not in scs: scs.append(b["scene"])
for sc in scs:
    bs = [b for b in T["beats"] if b["scene"] == sc]; key = sc.split(" ")[0]
    w(f"| {sc} | {tc(bs[0]['start'])} (f{fr(bs[0]['start'])}) | {tc(bs[-1]['end'])} (f{fr(bs[-1]['end'])}) | {bs[0]['id']}-{bs[-1]['id']} | {mood[key]} |")
w("\n## 5. Beat-by-beat sync sheet (what to show, when)\n")
w("Starred beats are the **bold / impact** lines (inferred; the source script had no formatting). 'Hit' = the cue that should coincide with a visual accent.\n")
w("| Beat | Role | Start | End | Frames | Line | Show |\n|---|---|---|---|---|---|---|")
hits = {c["cue"].split("_")[0]: c for c in S["cues"] if "BOLD" in c["note"]}
for b in T["beats"]:
    m = mb[b["id"]]
    w(f"| {'★ ' if b['impact'] else ''}{b['id']} | {b['role']} | {b['start']:.2f} | {b['end']:.2f} | f{fr(b['start'])}-f{fr(b['end'])} | {m['text'].replace('|','/')} | {m['visual_hint']} |")
w("\n### Bold-beat hit frames\n")
w("| Beat | Hit cue | Time | Frame | Sound | Visual accent to land on it |\n|---|---|---|---|---|---|")
acc = {"V03": "hard hold on the untouched glass; let the frame stop breathing", "V07b": "finger presses Enter / Approve; one tiny recoil in the screen glow",
       "V11": "smash back to the glowing present; screen light hits his face", "V15": "his face lights up; first and only wide, warm, open frame of the chapter",
       "V27": "face lit by green; hold on 'HE', then a slower push on the second HE", "V30": "last chime rings over black"}
for c in S["cues"]:
    if "BOLD" in c["note"]:
        k = c["cue"].split("_")[0]
        w(f"| {k} | `{c['cue']}` | {c['start']:.2f} | f{fr(c['start'])} | `{c['stem']}` | {acc.get(k, '')} |")
w("\n## 6. Rules for combining audio and picture\n")
w("1. **Cut to the voice.** Cuts land 0-6 frames *before* the stressed word, never after it. If the picture is already built, re-time it to the VO (remove/repeat static hold frames, shorten creeping settles) instead of re-cutting; keep untouched frames bit-identical and verify (PSNR / md5) when re-timing a rendered clip.")
w("2. **Gaps are breathing room, not dead air.** Gaps between beats are 0.25-2.2 s on purpose (list items V13a-d are 0.25 s apart; V17->V18 is 2.2 s so the phone buzz fits). Fill them with the picture's slow move, not with extra sound.")
w("3. **Do not add sound on top.** The cue sheet is the whole score. If something in the picture needs a sound that is not there, pick it from `stems/` (all individually named) and place it on a new track *above* the full mix at -10 dB or lower. Never use stock whoosh/riser/hit libraries.")
w("4. **Levels.** VO is about -19 LUFS before the mix (Ivan -21 inner, Claude -20, bold Ivan -19.5). The sound-design master is about -29 LUFS (it is ducked 7-9 dB under any speech automatically). The FULL mix is normalised to -16 LUFS integrated, true peak <= -1.5 dBFS. Do not re-normalise individual stems.")
w("5. **Do not time-stretch the VO or the sound design.** If a line must move, move the whole beat (and its cues move with it, as they are anchored to beat ids; re-run `render_mix.py --timeline`).")
w("6. **Use the reference clip as the look, not the clock.** `Ch01-Scene01.mp4` is 37.0 s of picture with ~31 s of its own scratch VO. The new Scene 1 (S1) runs from the 3 s pre-roll to the end of V07b, so its picture needs to be re-timed to the new VO. The dark CG look, wall clock, warm lamp vs cold screen glow and the DRAFT -> REVIEW -> SEND pipeline graph are all right and should be kept.")
w("7. **Captions** (if used): `04_TIMELINE/ch01_vo_captions.srt` uses the same clock as the audio.\n")
w("## 7. Sound events that need an on-screen counterpart\n")
w("These are the cues where an audio event implies something visible. Make the picture do it **at that frame** (+/- 2 frames):\n")
w("| Time | Frame | Cue | Sound | What should be visible |\n|---|---|---|---|---|")
for c in S["cues"]:
    if c["kind"] == "shot" and c["note"] and c["bus"] in ("ui", "hits", "foley"):
        w(f"| {c['start']:.2f} | f{fr(c['start'])} | `{c['cue']}` | `{c['stem'].replace('.wav','')}` | {c['note'].replace('BOLD  ','')} |")
w("\n## 8. Full cue list (beds)\n")
w("| Start | End | Cue | Stem | Bus | Gain dB | Note |\n|---|---|---|---|---|---|---|")
for c in S["cues"]:
    if c["kind"] == "bed": w(f"| {c['start']:.2f} | {c['end']:.2f} | `{c['cue']}` | `{c['stem']}` | {c['bus']} | {c['gain_db']} | {c['note']} |")
w("\n## 9. QA checklist before you hand the video back\n")
w("- [ ] Video and FULL mix have the same duration to within a frame; first frame = t=0 of the audio.")
w("- [ ] V03 'It's still full.' lands with the hold on the glass; the glass is **full** in V03 and again in V30b (the same shot, deliberate echo).")
w("- [ ] V11 smash-back hits on the screen light; V15 is the only warm, open frame; V17 ends exactly as the pulse is cut.")
w("- [ ] The 4 modules (V13a-d) light on their own pings, in order: Calendar, Scheduler, Docs, Research.")
w("- [ ] V27 'HE' is on a locked-off or very slow shot; nothing moves on the second 'HE' except the face.")
w("- [ ] After V30b the last picture is black *before* the hollow chime; the chime tail rings to the end (6 s tail).")
w("- [ ] `ffmpeg -i final.mp4 -af ebur128 -f null -` reports about -16 LUFS integrated and true peak <= -1.5 dBTP.")
w("- [ ] Spot-check three timestamps in the final export by playing them: V03, V11, V27.\n")
w("## 10. Known limits\n")
w("- All sound design is generated procedurally (numpy/scipy), because the ElevenLabs connector used here cannot make music. It was checked by measurement (levels, loudness, spectrum, loop seams, clipping), not by ear: **listen once and tell Swastik what to change** (gain, which stems to drop).")
w("- Voices were picked from ElevenLabs' descriptions; alternates are listed in `02_VOICEOVER/vo_script_ch1.md`.")
w("- The bold-beat list is inferred. Word-level cues (e.g. 'HE' x2 in V27) are anchored by fraction of the clip, not by word timing; with the real clips, nudge `cues.py` offsets if a hit sits a few frames off the word and re-run `render_mix.py`.")
open(R + "/01_GUIDE/GUIDE_FOR_VISUAL_CLAUDE.md", "w").write("\n".join(L) + "\n")
print("guide lines", len(L))
