# Chapter 1 ("The Binge") - voiceover + sound design package

**Start with `01_GUIDE/GUIDE_FOR_VISUAL_CLAUDE.md`** (hand that file, `04_TIMELINE/` and `03_SOUND_DESIGN/cue_sheet.csv` to the Claude that builds the picture).

> The package comes as 6 zips (chat upload limit). Unzip **all of them into the same folder**; they all share the root `Ch01_VO_SoundPackage/` and merge. part1 = guide/scripts/tools/small stems, part2 = ambience stems, part3 = music/drone stems, part4-5 = the five buses, part6 = the no-VO master mix.

## Status
| Part | State |
|---|---|
| Script analysis, casting, emotion/direction plan (36 beats, 6 scenes, 6 bold beats) | done: `02_VOICEOVER/vo_script_ch1.md` |
| Chapter 1 voiceover generation (ElevenLabs, eleven_v4, 36 beats x 2 takes = 72 takes) | **generated** in the flow https://elevenlabs.io/app/flows/lA3X5etNQbpzzGTwm6Tv. **Audio files are NOT in this zip**: the build sandbox's network policy blocked the ElevenLabs file host, so the takes could not be downloaded here. Generation ids are in `02_VOICEOVER/takes.json` |
| Sound design: 59 individual stems, 5 bus submixes, no-VO master, 98-cue sheet | done, 48 kHz / 24-bit |
| Processing chains + assembly (Ivan inner voice, Claude's robot blend, narrator) | done and tested end-to-end with stand-in clips: `tools/build_vo.py` |

## Folder map
```
01_GUIDE/       GUIDE_FOR_VISUAL_CLAUDE.md
02_VOICEOVER/   vo_script_ch1.md  vo_manifest.json  takes.json  clips_DROP_HERE/  processing/CHAINS.md
03_SOUND_DESIGN/
   stems/       ambience/ music_drones/ ui_digital/ designed_sfx/ foley/ impacts/ transitions/   (59 stems, 24-bit FLAC here; the same 59 as WAV are in Ch01_stems_WAV.zip)
   buses/       (FLAC in the zip; render_mix.py rewrites WAV) bus_1_ambience ... bus_5_hits_transitions   (full length, sample-aligned, sum = master)
   mixes/       ch01_sound_design_noVO.flac
   cue_sheet.csv / .json
04_TIMELINE/    timeline.json  ch01_vo_captions.srt  ch01_vo_markers.csv  ch01_timeline.png
tools/          build_vo.py  render_mix.py  make_manifest.py  make_guide.py  cues.py  stems_*.py  dsp.py  render_stems.py
```

## Finishing the VO (3 steps)
1. Open the flow, download the takes, and save each as `02_VOICEOVER/clips_DROP_HERE/V01_A.mp3`, `V01_B.mp3`, `V02_A.mp3` ... (the flow nodes are labelled by beat id; take A = first variation).
2. `cd tools && python3 build_vo.py` (needs ffmpeg + numpy + scipy). Optional `02_VOICEOVER/choices.json` like `{"V15":"B"}` picks take B per beat.
3. `python3 render_mix.py --vo ../02_VOICEOVER/master/ch01_vo_master.wav` then `python3 make_guide.py`.
Result: processed beats, three role stems (narrator / Ivan / Claude), VO master, sound design re-timed to the real clip lengths, and `mixes/ch01_FULL_mix_VO_plus_sound.wav` at -16 LUFS / <= -1.5 dBFS.

## Formats
Everything is 48 kHz / 24-bit stereo. In this zip the stems, buses and the no-VO master are lossless FLAC to keep the download small. `tools/render_mix.py` reads FLAC or WAV stems and writes WAV buses/mixes. WAV stems: `Ch01_stems_WAV.zip` (unzip over `03_SOUND_DESIGN/stems/`), or `python3 tools/render_stems.py`.

## Honest notes
- The sound design is procedural (the ElevenLabs connector here has no music generator) and was verified by measurement, not by listening. Voices were chosen from their descriptions. Please listen and tell me what to change: every cue has a gain in `tools/cues.py`.
- The script file had no bold formatting; impact beats (V03, V07b, V11, V15, V27, V30b) are inferred.
