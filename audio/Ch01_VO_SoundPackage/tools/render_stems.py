"""Render every procedural stem to 24-bit/48k stereo WAV into 03_SOUND_DESIGN/stems/<category>/.
Writes stems_index.json (name, category, duration, peak, rms, loop flag). Deterministic (seeded)."""
import os, sys, json, time, inspect
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np
import dsp, stems_beds, stems_sfx

OUT = os.path.join(HERE, "..", "03_SOUND_DESIGN", "stems")
CATS = [("amb_", "ambience"), ("fol_wall_clock", "ambience"), ("mus_", "music_drones"), ("ui_", "ui_digital"),
        ("sfx_", "designed_sfx"), ("fol_", "foley"), ("imp_", "impacts"), ("trn_", "transitions")]
LOOPS = {"fol_wall_clock_tick", "fol_heartbeat_62bpm_loop", "mus_drone_isolation", "mus_pulse_hold"}
def cat_of(n):
    for p, c in CATS:
        if n.startswith(p): return c
def main(only=None):
    idx = []
    for mod in (stems_beds, stems_sfx):
        for name, fn in inspect.getmembers(mod, inspect.isfunction):
            if name.startswith("_") or fn.__module__ != mod.__name__: continue
            c = cat_of(name)
            if not c or (only and name not in only): continue
            t0 = time.time()
            try: x = fn()
            except Exception as e:
                print("FAIL", name, repr(e)); continue
            if x.ndim == 1: x = np.stack([x, x], 1)
            # DC clean-up: remove the global offset on long stems (no filter => no edge transients, loops stay seamless)
            if len(x) > dsp.SR: x = x - x.mean(0, keepdims=True)
            d = os.path.join(OUT, c); os.makedirs(d, exist_ok=True)
            dsp.write_wav24(os.path.join(d, name + ".wav"), x)
            rec = dict(name=name, category=c, file=f"{c}/{name}.wav", duration=round(len(x) / dsp.SR, 3),
                       peak_db=round(dsp.peak_db(x), 1), rms_db=round(dsp.rms_db(x), 1),
                       loop=(name in LOOPS or name.startswith("amb_")), doc=(inspect.getdoc(fn) or "").split("\n")[0])
            idx.append(rec); print(f"{name:34s} {rec['duration']:6.2f}s pk {rec['peak_db']:6.1f} rms {rec['rms_db']:6.1f} ({time.time()-t0:.1f}s)")
    json.dump(idx, open(os.path.join(OUT, "stems_index.json"), "w"), indent=1)
    print(len(idx), "stems")
if __name__ == "__main__": main(sys.argv[1:] or None)
