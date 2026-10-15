"""Build vo_manifest.json + timeline.json from ch1_beats.py and takes.json.

timeline.json is the master clock for the chapter: every beat's start/end in seconds,
computed from the chosen take's duration + the editorial gap before it.

Usage:
    python3 make_manifest.py                  # take A for every beat (default)
    python3 make_manifest.py --take B         # take B for every beat
    python3 make_manifest.py --durations-dir ../02_VOICEOVER/clips_DROP_HERE
        # use the REAL clip durations (clips named V01_A.mp3 / V01_B.mp3 ...) instead of
        # the durations ElevenLabs reported. Needs ffprobe.
"""
import argparse, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ch1_beats as c

def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "default=nw=1:nk=1", path]).decode().strip()
    return float(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--take", default="A")
    ap.add_argument("--durations-dir", default=None)
    ap.add_argument("--choices", default=None, help="json file {beat_id: 'A'|'B'} overriding --take per beat")
    a = ap.parse_args()
    takes = json.load(open(os.path.join(HERE, "..", "02_VOICEOVER", "takes.json")))
    choices = json.load(open(a.choices)) if a.choices else {}
    t = c.PRE_ROLL
    beats, vo = [], []
    for b in c.B:
        tk = choices.get(b["id"], a.take)
        take = next(x for x in takes[b["id"]] if x["take"] == tk)
        dur = take["duration_s"]
        if a.durations_dir:
            for ext in ("wav", "mp3", "flac"):
                p = os.path.join(a.durations_dir, f"{b['id']}_{tk}.{ext}")
                if os.path.exists(p):
                    dur = round(probe(p), 3)
                    break
        start = round(t + b["gap_before"], 3) if beats else round(t, 3)
        end = round(start + dur, 3)
        beats.append(dict(id=b["id"], scene=b["scene"], role=b["role"], take=tk, start=start, end=end,
                          duration=dur, gap_before=b["gap_before"], impact=b["impact"]))
        t = end
        vo.append(dict(id=b["id"], scene=b["scene"], role=b["role"], voice=c.VOICES[b["role"]]["name"],
                       voice_id=c.VOICES[b["role"]]["voice_id"], model=c.MODEL, text=b["text"],
                       elevenlabs_prompt=b["prompt"], direction=b["direction"], visual_hint=b["visual"],
                       impact_beat=b["impact"], processing_chain=b["chain"], gap_before_s=b["gap_before"],
                       takes=takes[b["id"]], default_take=tk, file_names=[f"{b['id']}_A.mp3", f"{b['id']}_B.mp3"]))
    total = round(t + c.TAIL, 3)
    json.dump(dict(chapter="Ch 1 - The Binge", flow_id=c.FLOW_ID, flow_url=c.FLOW_URL, model=c.MODEL,
                   voices=c.VOICES, beats=vo),
              open(os.path.join(HERE, "..", "02_VOICEOVER", "vo_manifest.json"), "w"), indent=1)
    json.dump(dict(chapter="Ch 1 - The Binge", pre_roll=c.PRE_ROLL, tail=c.TAIL, total_duration=total,
                   note="start/end are seconds from t=0 of the chapter audio (room tone starts at 0, V01 starts at pre_roll).",
                   beats=beats),
              open(os.path.join(HERE, "..", "04_TIMELINE", "timeline.json"), "w"), indent=1)
    print("beats", len(beats), "total", total, "s")

if __name__ == "__main__":
    main()
