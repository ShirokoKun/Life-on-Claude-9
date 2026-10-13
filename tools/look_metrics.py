"""Measure a frame the way docs/LOOK_ANALYSIS.md measures the OpenKnight reference.

    python3 tools/look_metrics.py frame.png [more.png ...]

Letterbox rows (near-black full rows) are cropped first. Prints one row per frame.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter


def crop_letterbox(a):
    rows = a.max(axis=(1, 2)) > 0.02
    idx = np.where(rows)[0]
    return a[idx[0]:idx[-1] + 1] if len(idx) else a


def metrics(path):
    im = Image.open(path).convert("RGB")
    a = crop_letterbox(np.asarray(im).astype(np.float32) / 255)
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lit = Y > 0.05
    hi = Y > 0.6
    sh = (Y > 0.003) & (Y < 0.03)
    warm = lambda m: float((a[..., 0][m] - a[..., 2][m]).mean()) if m.any() else float("nan")
    g = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).convert("L")).astype(np.float32)
    blur = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)
    flat = np.abs(np.gradient(blur)[0]) + np.abs(np.gradient(blur)[1]) < 1.5
    noise = float(np.mean(np.abs(g - blur)[flat])) if flat.any() else float("nan")
    lap = np.abs(g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    sharp = float((lap > 24).mean() * 100)
    return dict(black=float((Y < 0.003).mean() * 100), p50=float(np.median(Y)), p995=float(np.percentile(Y, 99.5)),
                sat=float(sat[lit].mean()) if lit.any() else 0, shWarm=warm(sh), hiWarm=warm(hi),
                noise=noise, sharp=sharp, hiArea=float(hi.mean() * 100))


if __name__ == "__main__":
    keys = ["black", "p50", "p995", "sat", "shWarm", "hiWarm", "noise", "sharp", "hiArea"]
    print("frame".ljust(28), *[k.rjust(7) for k in keys])
    for p in sys.argv[1:]:
        m = metrics(p)
        print(p.split("/")[-1][:28].ljust(28), *[f"{m[k]:7.3f}" for k in keys])
