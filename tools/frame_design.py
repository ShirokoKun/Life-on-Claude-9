"""Frame-design measurements (composition and light structure), for references and our frames alike.

    python3 tools/frame_design.py img1 img2 ...

contrast   std of log2 luminance over the frame (stops of spread: flat ~1.5, dramatic 2.5+)
range      p95/p5 luminance in stops
mid%       share of the frame in the dull midtones (0.03-0.25 linear): high = flat, grey
keyfill    stops between the brightest 5% and the median of the subject zone (centre third)
subj/bg    stops the centre-third subject sits above the outer frame (separation)
dark%      share below 0.01 linear (negative space)
centroid   where the light sits (x, y of the luminance-weighted centre, 0-1)
"""
import sys

import numpy as np
from PIL import Image


def crop(a):
    rows = a.max(axis=(1, 2)) > 0.02
    i = np.where(rows)[0]
    return a[i[0]:i[-1] + 1] if len(i) else a


def run(p):
    a = crop(np.asarray(Image.open(p).convert("RGB").resize((640, 360))).astype(np.float32) / 255)
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32) + 1e-4
    L = np.log2(Y)
    h, w = Y.shape
    c = Y[h // 6: 5 * h // 6, w // 3: 2 * w // 3]
    edge = np.concatenate([Y[:, : w // 6].ravel(), Y[:, 5 * w // 6:].ravel()])
    yy, xx = np.mgrid[0:h, 0:w]
    return dict(contrast=L.std(), range=np.log2(np.percentile(Y, 95) / np.percentile(Y, 5)),
                mid=((Y > 0.03) & (Y < 0.25)).mean() * 100,
                keyfill=np.log2(np.percentile(c, 95) / np.median(c)),
                subjbg=np.log2(np.median(c) / np.median(edge)), dark=(Y < 0.01).mean() * 100,
                cx=(Y * xx).sum() / Y.sum() / w, cy=(Y * yy).sum() / Y.sum() / h)


if __name__ == "__main__":
    keys = ["contrast", "range", "mid", "keyfill", "subjbg", "dark", "cx", "cy"]
    print("frame".ljust(22), *[k.rjust(8) for k in keys])
    for p in sys.argv[1:]:
        m = run(p)
        print(p.split("/")[-1][:22].ljust(22), *[f"{m[k]:8.2f}" for k in keys])
