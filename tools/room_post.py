"""The tutorial film's lens and grade, measured (look_metrics: tutorial black share 0 %, median 0.06, softer than raw
Cycles) and applied after the render: lifted blacks, raised mids, bloom/haze around clipped windows, a slightly cool,
desaturated grade, lens softness, vignette, grain. Deterministic per frame (the grain seed is the frame index).

    python3 tools/room_post.py IN.png OUT.png            (one frame)
    python3 tools/room_post.py --dir IN_DIR OUT_DIR      (a sequence; frames named f_NNNN.png)
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter

def post(im, seed=0):
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255.0
    h, w, _ = a.shape
    # bloom + haze: everything near clipping glows; a wide, faint veil (the milky light round the windows)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hi = np.clip((lum - 0.9) / 0.1, 0, 1)[..., None] * a        # only what really clips glows
    hi_im = Image.fromarray((hi * 255).astype(np.uint8))
    b1 = np.asarray(hi_im.filter(ImageFilter.GaussianBlur(w * 0.012))).astype(np.float32) / 255
    b2 = np.asarray(hi_im.filter(ImageFilter.GaussianBlur(w * 0.05))).astype(np.float32) / 255
    a = a + b1 * 0.16 + b2 * 0.12
    # lens softness: a touch of blur mixed back (the tutorial is softer than raw Cycles)
    soft = np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w / 1600))).astype(np.float32) / 255
    a = a * 0.8 + soft * 0.2
    # tone: lift the blacks (never crushed), raise the mids, keep the clipped windows
    a = 0.022 + a * (1 - 0.022)
    a = np.power(np.clip(a, 0, None), 0.97)
    a = np.where(a > 0.72, 0.72 + (a - 0.72) * 0.55, a)              # highlight shoulder: bright blinds keep their slats
    # grade: slight desaturation, cooler shadows, neutral-warm highlights
    l = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    a = l + (a - l) * 0.8
    sh = np.clip(1 - l / 0.35, 0, 1)
    a = a + sh * np.array([-0.006, 0.0, 0.014], np.float32)
    # vignette
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r2 = ((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2) * 2.0
    a = a * (1 - 0.32 * np.clip(r2, 0, 1) ** 1.4)[..., None]
    # grain: fine, luminance-weighted, seeded by frame
    rng = np.random.default_rng(seed)
    g = rng.normal(0, 1, (h, w)).astype(np.float32)[..., None]
    a = a + g * 0.008 * (0.4 + 0.6 * np.sqrt(np.clip(l, 0, 1)))
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    if sys.argv[1] == '--dir':
        src, dst = sys.argv[2], sys.argv[3]; os.makedirs(dst, exist_ok=True)
        for p in sorted(glob.glob(os.path.join(src, 'f_*.png'))):
            n = int(''.join(c for c in os.path.basename(p) if c.isdigit()) or 0)
            out = os.path.join(dst, os.path.basename(p))
            if not os.path.exists(out): post(Image.open(p), n).save(out)
        print('graded', len(glob.glob(os.path.join(dst, 'f_*.png'))))
    else:
        post(Image.open(sys.argv[1])).save(sys.argv[2]); print('graded', sys.argv[2])
