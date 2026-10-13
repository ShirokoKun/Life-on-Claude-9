"""Film grain for rendered frames (deterministic per frame index), applied after Blender's compositor.

    python3 tools/post_grain.py IN.png OUT.jpg [--frame N] [--amount 0.035]
Grain is luminance-weighted (strongest in the mids, like film), slightly coarse, monochrome.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter


def grain(img, frame=0, amount=0.035):
    rng = np.random.default_rng(1000 + frame)
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    h, w, _ = a.shape
    n = rng.normal(0.0, 1.0, (h // 2 + 1, w // 2 + 1)).astype(np.float32)
    n = np.asarray(Image.fromarray(((n * 0.25 + 0.5) * 255).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
                   .filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 255.0 - 0.5
    lum = a.mean(axis=2, keepdims=True)
    weight = 4.0 * lum * (1.0 - lum) + 0.25
    out = np.clip(a + n[..., None] * amount * 4.0 * weight, 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8))


if __name__ == "__main__":
    args = sys.argv[1:]
    frame = int(args[args.index("--frame") + 1]) if "--frame" in args else 0
    amount = float(args[args.index("--amount") + 1]) if "--amount" in args else 0.035
    grain(Image.open(args[0]), frame, amount).save(args[1], quality=92)
