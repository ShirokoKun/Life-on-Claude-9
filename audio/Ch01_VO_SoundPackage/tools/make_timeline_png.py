"""04_TIMELINE/ch01_timeline.png - VO beats, cue lanes per bus, master envelope + spectrogram."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import dsp
R = os.path.join(HERE, "..")
T = json.load(open(R + "/04_TIMELINE/timeline.json")); S = json.load(open(R + "/03_SOUND_DESIGN/cue_sheet.json"))
x, sr = dsp.read_wav(R + "/03_SOUND_DESIGN/mixes/ch01_sound_design_noVO.wav"); m = x.mean(1)
bus_order = ["music", "amb", "hits", "ui", "foley"]; col = dict(music="#6c8cff", amb="#7aa88a", hits="#ff7a59", ui="#42d1c8", foley="#d9b45a")
fig = plt.figure(figsize=(26, 11), dpi=80); fig.patch.set_facecolor("#0e1116")
gs = fig.add_gridspec(4, 1, height_ratios=[1.0, 3.2, 1.0, 1.4], hspace=0.12)
def style(ax):
    ax.set_facecolor("#151a21"); ax.tick_params(colors="#9aa6b2", labelsize=8)
    for s in ax.spines.values(): s.set_color("#2a323c")
    ax.set_xlim(0, T["total_duration"])
ax = fig.add_subplot(gs[0]); style(ax); ax.set_ylim(0, 3); ax.set_yticks([0.5, 1.5, 2.5]); ax.set_yticklabels(["CLAUDE", "IVAN", "NARRATOR"], color="#9aa6b2")
rc = dict(NAR=(2, "#e8e8e8"), IVAN=(1, "#ffd479"), CLAUDE=(0, "#8fd3ff"))
for b in T["beats"]:
    y, c = rc[b["role"]]; ax.add_patch(plt.Rectangle((b["start"], y + 0.1), b["end"] - b["start"], 0.8, color=c, alpha=0.95 if b["impact"] else 0.55, ec="#ff7a59" if b["impact"] else "none", lw=2))
    ax.text(b["start"] + 0.2, y + 0.5, b["id"], fontsize=6.5, color="#0e1116", va="center")
ax.set_title("Chapter 1 - VO beats (orange outline = BOLD / impact beat)  |  cue lanes  |  no-VO master", color="#e6edf3", fontsize=11, loc="left")
for sc in sorted({b["scene"] for b in T["beats"]}):
    bs = [b for b in T["beats"] if b["scene"] == sc]; ax.axvline(bs[0]["start"] - 0.5, color="#ff7a59", lw=0.6, ls="--")
ax2 = fig.add_subplot(gs[1], sharex=ax); style(ax2); ax2.set_ylim(0, len(bus_order) * 6)
for c in S["cues"]:
    lane = bus_order.index(c["bus"]); base = (len(bus_order) - 1 - lane) * 6
    if c["kind"] == "bed":
        k = sum(1 for d in S["cues"] if d["bus"] == c["bus"] and d["kind"] == "bed" and d["start"] < c["start"] and d["end"] > c["start"])
        ax2.add_patch(plt.Rectangle((c["start"], base + 0.3 + (k % 3) * 1.3), c["end"] - c["start"], 1.1, color=col[c["bus"]], alpha=0.45))
        ax2.text(c["start"] + 0.3, base + 0.55 + (k % 3) * 1.3, c["cue"], fontsize=6, color="#e6edf3")
    else:
        ax2.vlines(c["start"], base + 4.0, base + 5.6, color=col[c["bus"]], lw=1.6)
        ax2.text(c["start"] + 0.12, base + 4.1 + (hash(c["cue"]) % 4) * 0.4, c["stem"].replace(".wav", "").replace("ui_", "").replace("fol_", ""), fontsize=5.2, color=col[c["bus"]], rotation=40)
ax2.set_yticks([(len(bus_order) - 1 - i) * 6 + 3 for i in range(len(bus_order))]); ax2.set_yticklabels(bus_order, color="#9aa6b2")
ax3 = fig.add_subplot(gs[2], sharex=ax); style(ax3)
w = sr // 20; e = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, "same"))[::w // 2]; tt = np.arange(len(e)) * (w // 2) / sr
ax3.fill_between(tt, 20 * np.log10(e + 1e-6), -90, color="#a78bfa", alpha=0.7); ax3.set_ylim(-70, -15); ax3.set_ylabel("dBFS rms", color="#9aa6b2", fontsize=8)
ax4 = fig.add_subplot(gs[3], sharex=ax); style(ax4)
ax4.specgram(m, NFFT=4096, Fs=sr, noverlap=2048, cmap="magma", vmin=-130, vmax=-50); ax4.set_ylim(0, 12000); ax4.set_xlim(0, T["total_duration"]); ax4.set_xlabel("seconds", color="#9aa6b2")
fig.savefig(R + "/04_TIMELINE/ch01_timeline.png", bbox_inches="tight", facecolor=fig.get_facecolor()); print("ok")
