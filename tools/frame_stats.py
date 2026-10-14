"""Frame stats for look matching: mean, percentiles, near-black share and mean RGB (letterbox rows skipped).
    python -I tools/frame_stats.py a.png b.png ..."""
import sys
import numpy as np
from PIL import Image

for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB').resize((480, 270))).astype(np.float32) / 255
    h = a.shape[0]
    a = a[int(h * 0.16):int(h * 0.84)]                  # skip letterbox bars (ours are 2.39:1, refs vary)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    p = np.percentile(y, [10, 25, 50, 75, 90, 99])
    rgb = a.reshape(-1, 3).mean(0)
    print(f"{f.split('/')[-1][:34]:34s} mean {y.mean():.3f}  p10 {p[0]:.3f} p25 {p[1]:.3f} p50 {p[2]:.3f} p75 {p[3]:.3f} "
          f"p90 {p[4]:.3f} p99 {p[5]:.3f}  black<0.03 {np.mean(y < 0.03) * 100:4.1f}%  rgb {rgb.round(3)}")
