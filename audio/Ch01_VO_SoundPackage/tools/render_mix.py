"""Render the Chapter 1 sound-design bus submixes + the no-VO master from the cue list.

    python3 render_mix.py                       # uses ../04_TIMELINE/timeline.json
    python3 render_mix.py --timeline my.json    # re-time to real clip durations (make_manifest.py --durations-dir ...)
    python3 render_mix.py --vo ../02_VOICEOVER/master/ch01_vo_master.wav   # also writes the full mix with VO

Outputs (../03_SOUND_DESIGN): buses/bus_*.wav (all full-length, sample-aligned, sum = master), mixes/*.wav,
cue_sheet.csv / cue_sheet.json (every resolved cue time)."""
import os, sys, json, csv, argparse, subprocess, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
import dsp
from dsp import SR, n, db
import cues as C

ROOT = os.path.join(HERE, "..")
STEMS = os.path.join(ROOT, "03_SOUND_DESIGN", "stems")
BUSES = ["amb", "music", "ui", "foley", "hits"]
BUS_NAME = dict(amb="ambience", music="music", ui="ui_digital", foley="foley", hits="hits_transitions")
NOVO_TARGET_LUFS = -29.0
BUS_TRIM = dict(amb=4.0, music=7.0, ui=-3.0, foley=2.0, hits=-3.0)   # balance between buses, dB (set after metering)

def load_index():
    return {r["name"]: r for r in json.load(open(os.path.join(STEMS, "stems_index.json")))}

_cache = {}
def stem(name, idx):
    if name not in _cache:
        p = os.path.join(STEMS, idx[name]["file"])
        if os.path.exists(p): x, sr = dsp.read_wav(p)
        else:   # the zip ships stems as 24-bit FLAC (lossless); decode with ffmpeg
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p[:-4] + ".flac", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                                 stdout=subprocess.PIPE, check=True).stdout
            x = np.frombuffer(raw, "<f4").astype(np.float64).reshape(-1, 2)
        if x.shape[1] == 1: x = np.repeat(x, 2, 1)
        _cache[name] = x
    return _cache[name]

def resolve(a, tl):
    b, m, v = a
    if b == "abs": return float(v)
    t = tl[b]
    return {"s": t["start"] + v, "e": t["end"] + v, "f": t["start"] + v * (t["end"] - t["start"])}[m]

def lufs(x, sr=SR):
    """Integrated loudness via ffmpeg ebur128."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", "-",
                        "-af", "ebur128=peak=true", "-f", "null", "-"], input=x.astype("<f4").tobytes(),
                       stderr=subprocess.PIPE, stdout=subprocess.PIPE).stderr.decode()
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", p); tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", p)
    return (float(I[-1]) if I else -70.0), (float(tp[-1]) if tp else 0.0)

def speech_mask(tl, total, pad_pre=0.05, pad_post=0.15):
    ctl = 1000; m = np.zeros(int(total * ctl) + 2)
    for b in tl.values():
        m[int((b["start"] - pad_pre) * ctl): int((b["end"] + pad_post) * ctl)] = 1.0
    # smooth: fast attack (0.12 s), slow release (0.6 s)
    out = np.zeros_like(m); y = 0.0
    ka, kr = 1 - np.exp(-1 / (0.12 * ctl)), 1 - np.exp(-1 / (0.6 * ctl))
    for i, v in enumerate(m):
        y += (ka if v > y else kr) * (v - y); out[i] = y
    return np.interp(np.arange(int(total * SR)) / SR, np.arange(len(out)) / ctl, out)

def render(tl, total, idx):
    buses = {b: np.zeros((n(total), 2)) for b in BUSES}
    mask = speech_mask(tl, total); sheet = []
    for c in C.CUES:
        x = stem(c["stem"], idx); t0 = resolve(c["start"], tl)
        if c["kind"] == "bed":
            t1 = resolve(c["end"], tl); L = max(n(t1 - t0), 1)
            if c["loop"] and len(x) < L:
                reps = int(np.ceil(L / len(x))); x = np.tile(x, (reps, 1))
            y = x[:L].copy()
            if len(y) < L: y = np.pad(y, ((0, L - len(y)), (0, 0)))
            y = dsp.fade(y, c["fi"], c["fo"])
        else:
            y = x.copy(); t1 = t0 + len(y) / SR
            if c["fo"]: y = dsp.fade(y, 0, c["fo"])
        g = np.full(len(y), db(c["gain"]))
        if c["auto"]:
            pts = sorted((resolve(a, tl), d) for a, d in c["auto"])
            tt_ = t0 + np.arange(len(y)) / SR
            g = g * db(np.interp(tt_, [p[0] for p in pts], [p[1] for p in pts]))
        if c["pan"]:
            p = (c["pan"] + 1) * np.pi / 4; y = y * np.array([np.cos(p), np.sin(p)]) * np.sqrt(2)
        s0 = n(t0)
        if s0 < 0: y = y[-s0:]; g = g[-s0:]; s0 = 0
        e0 = min(s0 + len(y), buses[c["bus"]].shape[0]); y = y[:e0 - s0]; g = g[:e0 - s0]
        if c["duck"] > 0:
            d = 1 - (1 - db(-c["duck"])) * mask[s0:e0]; g = g * d
        buses[c["bus"]][s0:e0] += y * g[:, None]
        sheet.append(dict(cue=c["id"], kind=c["kind"], bus=c["bus"], stem=c["stem"] + ".wav", start=round(t0, 3),
                          end=round(e0 / SR, 3), gain_db=c["gain"], duck_db=c["duck"], pan=c["pan"], note=c["note"],
                          anchor=f"{c['start'][0]}:{c['start'][1]}{c['start'][2]:+.2f}"))
    return buses, sheet

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeline", default=os.path.join(ROOT, "04_TIMELINE", "timeline.json"))
    ap.add_argument("--vo", default=None, help="processed VO master wav (same t=0 as the timeline) for the full mix")
    a = ap.parse_args()
    T = json.load(open(a.timeline)); tl = {b["id"]: b for b in T["beats"]}; total = T["total_duration"]
    idx = load_index()
    buses, sheet = render(tl, total, idx)
    for b in BUSES: buses[b] = buses[b] * db(BUS_TRIM[b])
    master = sum(buses.values())
    I, tp = lufs(master); trim = NOVO_TARGET_LUFS - I
    for b in BUSES: buses[b] = buses[b] * db(trim)
    master = master * db(trim)
    pk = dsp.peak_db(master)
    if pk > -1.5:                         # keep headroom, same trim for every bus so they still sum to the master
        k = db(-1.5 - pk); master *= k
        for b in BUSES: buses[b] *= k
    os.makedirs(os.path.join(ROOT, "03_SOUND_DESIGN", "buses"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "03_SOUND_DESIGN", "mixes"), exist_ok=True)
    rep = {}
    for i, b in enumerate(BUSES, 1):
        f = f"bus_{i}_{BUS_NAME[b]}.wav"
        dsp.write_wav24(os.path.join(ROOT, "03_SOUND_DESIGN", "buses", f), buses[b])
        rep[f] = dict(peak=round(dsp.peak_db(buses[b]), 1), lufs=round(lufs(buses[b])[0], 1))
    dsp.write_wav24(os.path.join(ROOT, "03_SOUND_DESIGN", "mixes", "ch01_sound_design_noVO.wav"), master)
    I2, tp2 = lufs(master); rep["master_noVO"] = dict(lufs=round(I2, 1), peak=round(dsp.peak_db(master), 1), dur=round(len(master) / SR, 2))
    if a.vo:
        v, sr = dsp.read_wav(a.vo)
        if sr != SR: raise SystemExit("VO must be 48 kHz")
        if v.shape[1] == 1: v = np.repeat(v, 2, 1)
        N = max(len(v), len(master)); full = np.zeros((N, 2)); full[:len(master)] += master; full[:len(v)] += v
        # final delivery: loudness-match to -16 LUFS
        Iv, _ = lufs(full); full *= db(-16 - Iv)
        pkf = dsp.peak_db(full)
        if pkf > -1.5: full *= db(-1.5 - pkf)
        dsp.write_wav24(os.path.join(ROOT, "03_SOUND_DESIGN", "mixes", "ch01_FULL_mix_VO_plus_sound.wav"), full)
        rep["full_mix"] = dict(lufs=round(lufs(full)[0], 1), peak=round(dsp.peak_db(full), 1))
    csvp = os.path.join(ROOT, "03_SOUND_DESIGN", "cue_sheet.csv")
    sheet.sort(key=lambda r: (r["start"], r["cue"]))
    with open(csvp, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(sheet[0].keys())); w.writeheader(); w.writerows(sheet)
    json.dump(dict(total_duration=total, trim_applied_db=round(trim, 2), cues=sheet), open(os.path.join(ROOT, "03_SOUND_DESIGN", "cue_sheet.json"), "w"), indent=1)
    print(json.dumps(rep, indent=1)); print("trim", round(trim, 2), "dB; cues", len(sheet))

if __name__ == "__main__": main()
