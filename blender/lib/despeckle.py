"""Clean baked lightmaps: kill fireflies and the leftover grain OIDN misses in dark areas (they read as glitter and
'random texture' on the duvet and the floor). Runs on the installed EXRs; the raw bake stays in renders/.
  blender -b --factory-startup --python blender/lib/despeckle.py -- [--soft=N] <src.exr> <dst.exr> [...pairs]
--soft=N softens hard shadow edges (N 3x3 passes) as a stop-gap until the lights are re-baked softer."""
import sys
import bpy
import numpy as np


def shifts(a, r):
    h, w = a.shape
    p = np.pad(a, r, mode="edge")
    return [p[r + dy:r + dy + h, r + dx:r + dx + w] for dy in range(-r, r + 1) for dx in range(-r, r + 1)]


def clean(rgb, soft=1):
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32) + 1e-6
    med = np.median(np.stack(shifts(lum, 1)), axis=0)
    # fireflies: a texel far brighter than its neighbours is pulled down to them
    k = np.minimum(1.0, 2.5 * med / lum)[..., None]
    rgb = rgb * k
    # grain, and with soft > 1 hard shadow edges: repeated 3x3 box blurs (~gaussian). Islands keep an 8 px margin,
    # so soft stays small; 0-texels (gutters) are kept out of the average so edges do not darken.
    w = (rgb.max(-1) > 0).astype(np.float32)
    for _ in range(soft):
        num = np.stack([np.mean(np.stack(shifts(rgb[..., c] * w, 1)), axis=0) for c in range(3)], -1)
        den = np.mean(np.stack(shifts(w, 1)), axis=0)[..., None]
        rgb = np.where(w[..., None] > 0, num / np.maximum(den, 1e-6), 0)
    return rgb


a = sys.argv[sys.argv.index("--") + 1:]
soft = 1
if a and a[0].startswith("--soft="):
    soft = int(a.pop(0).split("=")[1])
for src, dst in zip(a[::2], a[1::2]):
    im = bpy.data.images.load(src)
    w, h = im.size
    p = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(p)
    p = p.reshape(h, w, 4)
    before = float((p[..., :3].max(-1) > 10 * p[..., :3].mean()).mean())
    p[..., :3] = clean(p[..., :3], soft)
    p[..., 3] = 1.0
    o = bpy.data.images.new("o", w, h, float_buffer=True)
    o.pixels.foreach_set(p.ravel())
    o.filepath_raw = dst
    o.file_format = "OPEN_EXR"
    sc = bpy.context.scene.render.image_settings
    sc.file_format = "OPEN_EXR"; sc.color_depth = "16"; sc.exr_codec = "ZIP"
    o.save_render(dst, scene=bpy.context.scene)
    after = float((p[..., :3].max(-1) > 10 * p[..., :3].mean()).mean())
    print("despeckle", src.split("/")[-1], f"hot texels {before:.4f} -> {after:.4f}", flush=True)
    bpy.data.images.remove(im)
    bpy.data.images.remove(o)
