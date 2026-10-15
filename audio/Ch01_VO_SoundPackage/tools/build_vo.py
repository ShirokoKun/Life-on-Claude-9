"""Build the processed Chapter 1 voiceover from the raw ElevenLabs clips.

1. Drop the clips in ../02_VOICEOVER/clips_DROP_HERE/ named  V01_A.mp3, V01_B.mp3, V02_A.mp3 ...  (mp3/wav/flac)
   (A and B are the two takes generated per beat; see 02_VOICEOVER/takes.json for the generation ids.)
2. Optional: ../02_VOICEOVER/choices.json  {"V09": "B", "V15": "B"}  to pick take B for some beats (default A).
3. python3 build_vo.py        -> re-times the timeline to the REAL clip durations, then writes
     ../02_VOICEOVER/processed_beats/Vxx.wav      each beat, processed + loudness-matched (48 kHz / 24-bit mono)
     ../02_VOICEOVER/master/ch01_vo_narrator.wav   full-length, timeline-aligned role stems
     ../02_VOICEOVER/master/ch01_vo_ivan.wav
     ../02_VOICEOVER/master/ch01_vo_claude.wav
     ../02_VOICEOVER/master/ch01_vo_master.wav     the three summed (VO only)
     ../04_TIMELINE/timeline.json (+ ch01_vo_captions.srt, ch01_vo_markers.csv)
4. python3 render_mix.py --vo ../02_VOICEOVER/master/ch01_vo_master.wav   -> sound design re-timed + full mix

Needs ffmpeg/ffprobe + numpy/scipy."""
import os, sys, json, subprocess, argparse, csv
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
import dsp
from dsp import SR
import ch1_beats as c
from render_mix import lufs

ROOT = os.path.join(HERE, "..")
CLIPS = os.path.join(ROOT, "02_VOICEOVER", "clips_DROP_HERE")
TARGET = dict(NAR=-19.0, IVAN_INNER=-21.0, IVAN_BOLD=-19.5, CLAUDE_AI=-20.0)

# ffmpeg chains (see 02_VOICEOVER/processing/CHAINS.md for the reasoning). Input mono, output mono; loudness is set afterwards in python.
CHAINS = dict(
  NAR="highpass=f=75,equalizer=f=200:t=q:w=1.0:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.2,"
      "acompressor=threshold=-22dB:ratio=2.2:attack=15:release=160:makeup=2,aecho=0.9:0.25:42:0.06",
  IVAN_INNER="highpass=f=110,lowpass=f=7800,equalizer=f=180:t=q:w=1.0:g=2.0,equalizer=f=4500:t=q:w=1.0:g=-2.0,"
             "acompressor=threshold=-24dB:ratio=2.5:attack=8:release=120:makeup=2,aecho=0.8:0.55:27|63:0.16|0.08",
  IVAN_BOLD="highpass=f=110,lowpass=f=8500,equalizer=f=160:t=q:w=1.0:g=2.5,equalizer=f=3000:t=q:w=1.2:g=1.5,"
            "acompressor=threshold=-24dB:ratio=3:attack=6:release=140:makeup=3,aecho=0.8:0.7:55|120|210:0.24|0.14|0.07",
  CLAUDE_AI=None)   # needs filter_complex, below
CLAUDE_FC = ("[0:a]highpass=f=100,lowpass=f=10000,equalizer=f=2600:t=q:w=1.0:g=1.5,asplit[d][w];"
             "[w]afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75[r];"
             "[d][r]amix=inputs=2:weights=1 0.30:normalize=0,acompressor=threshold=-22dB:ratio=2:attack=10:release=120:makeup=1.5")

def find_clip(bid, take):
    for ext in ("wav", "mp3", "flac", "m4a"):
        p = os.path.join(CLIPS, f"{bid}_{take}.{ext}")
        if os.path.exists(p): return p

def process(src, chain_name):
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", str(SR)]
    if chain_name == "CLAUDE_AI": cmd += ["-filter_complex", CLAUDE_FC]
    else: cmd += ["-af", CHAINS[chain_name]]
    cmd += ["-f", "f32le", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)

def write_captions(tl):
    def ts(t): h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")
    with open(os.path.join(ROOT, "04_TIMELINE", "ch01_vo_captions.srt"), "w") as f:
        for i, b in enumerate(c.B, 1):
            f.write(f"{i}\n{ts(tl[b['id']]['start'])} --> {ts(tl[b['id']]['end'])}\n{b['text']}\n\n")
    with open(os.path.join(ROOT, "04_TIMELINE", "ch01_vo_markers.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["id", "scene", "role", "start_s", "end_s", "impact", "text"])
        for b in c.B: w.writerow([b["id"], b["scene"], b["role"], tl[b["id"]]["start"], tl[b["id"]]["end"], int(b["impact"]), b["text"]])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--captions-only", action="store_true"); ap.add_argument("--choices", default=os.path.join(ROOT, "02_VOICEOVER", "choices.json"))
    a = ap.parse_args()
    ch = json.load(open(a.choices)) if os.path.exists(a.choices) else {}
    args = [sys.executable, os.path.join(HERE, "make_manifest.py"), "--durations-dir", CLIPS]
    if ch: args += ["--choices", a.choices]
    subprocess.run(args, check=True)
    T = json.load(open(os.path.join(ROOT, "04_TIMELINE", "timeline.json"))); tl = {b["id"]: b for b in T["beats"]}
    if a.captions_only: write_captions(tl); return
    total = T["total_duration"]; N = int(total * SR)
    pb = os.path.join(ROOT, "02_VOICEOVER", "processed_beats"); ms = os.path.join(ROOT, "02_VOICEOVER", "master")
    os.makedirs(pb, exist_ok=True); os.makedirs(ms, exist_ok=True)
    roles = dict(NAR=np.zeros(N), IVAN=np.zeros(N), CLAUDE=np.zeros(N)); missing = []
    for b in c.B:
        take = ch.get(b["id"], "A"); src = find_clip(b["id"], take)
        if not src: missing.append(f"{b['id']}_{take}"); continue
        chain = b["chain"]
        if chain == "IVAN_INNER" and b["impact"]: chain = "IVAN_BOLD"
        y = process(src, chain)
        I, _ = lufs(np.stack([y, y], 1)); y = y * dsp.db(TARGET[chain] - I)
        pk = dsp.peak_db(y)
        if pk > -1.5: y = y * dsp.db(-1.5 - pk)
        dsp.write_wav24(os.path.join(pb, f"{b['id']}.wav"), np.stack([y, y], 1))
        s0 = int(round(tl[b["id"]]["start"] * SR)); e0 = min(s0 + len(y), N)
        roles[b["role"]][s0:e0] += y[:e0 - s0]
    for r, nm in (("NAR", "narrator"), ("IVAN", "ivan"), ("CLAUDE", "claude")):
        dsp.write_wav24(os.path.join(ms, f"ch01_vo_{nm}.wav"), np.stack([roles[r]] * 2, 1))
    mix = sum(roles.values()); dsp.write_wav24(os.path.join(ms, "ch01_vo_master.wav"), np.stack([mix, mix], 1))
    write_captions(tl)
    rep = dict(I=lufs(np.stack([mix, mix], 1)), peak=round(dsp.peak_db(mix), 1))
    print("VO master integrated LUFS / TP:", rep["I"], "peak", rep["peak"], "| total", total, "s")
    if missing: print("MISSING clips (left silent):", ", ".join(missing))

if __name__ == "__main__": main()
