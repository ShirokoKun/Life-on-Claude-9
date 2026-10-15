# Voice processing chains (implemented in tools/build_vo.py)

Raw ElevenLabs clips are kept clean; all character is added here so it can be dialled per chapter.
All chains work on mono 48 kHz; loudness is set per beat afterwards (ITU BS.1770 integrated, measured with ffmpeg ebur128), peak guard -1.5 dBFS.

| Chain | Used for | What it does | Target |
|---|---|---|---|
| NAR | the narrator (32 beats) | 75 Hz high-pass, +1.5 dB at 200 Hz (body), +1.2 dB at 3.2 kHz (presence), 2.2:1 compression, a 42 ms / 6% slap for a hint of room | -19 LUFS |
| IVAN_INNER | Ivan's thoughts / typed lines (V09, V22) | 110 Hz HPF, 7.8 kHz LPF (close, dry, inside the head), +2 dB at 180 Hz, -2 dB at 4.5 kHz, 2.5:1 compression, micro-echo 27/63 ms | -21 LUFS |
| IVAN_BOLD | Ivan's bold line (V27) | wider band, more presence, 3:1 compression, longer 55/120/210 ms echo that leaves a tail the vacuum drop can cut | -19.5 LUFS |
| CLAUDE_AI | Claude's voice (V10) | 100 Hz-10 kHz band, +1.5 dB at 2.6 kHz, **30% robotised copy** (zero-phase FFT resynthesis, window 512 / 75% overlap) blended under the natural voice, 2:1 compression | -20 LUFS |

## Dialling Claude's robot level across the series
`CLAUDE_FC` in build_vo.py: the weight in `amix=weights=1 0.30`. Chapter 1 = 0.30 (friendly, nearly natural). Raise it chapter by chapter (0.5, 0.8, ...) as Claude drifts, optionally dropping the `win_size` to 256 for a harder buzz.

## If a beat sounds wrong
Swap to take B (`../choices.json`), or generate a third take in the flow (it keeps the same beat prompt), or swap the voice for one of the alternates in `vo_script_ch1.md`.
