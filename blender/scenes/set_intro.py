"""The intro set: apartment shell + real materials + hero props + story dressing + lighting.

    python -I blender/scenes/set_intro.py OUT_DIR [--preset 3am|4am|sunrise] [--cams a,b,..]
                                         [--res 1600x800] [--samples 128] [--blend] [--no-look]

Renders story-shot stills (2:1, like the reference) with the film look applied.
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import apartment_shell as shell  # noqa: E402
import geo  # noqa: E402
import lighting  # noqa: E402
import materials  # noqa: E402
import props_desk  # noqa: E402

try:
    import props_story  # noqa: E402
except ImportError:
    props_story = None
try:
    import props_clutter  # noqa: E402
except ImportError:
    props_clutter = None
try:
    import exterior  # noqa: E402
except ImportError:
    exterior = None

# name: (position, look-at, focal mm, f-stop or None, focus target or None)
SHOTS = {
    "establish": ((4.55, 4.95, 1.55), (6.95, 2.95, 0.95), 24, None, None),
    "face":      ((6.90, 3.98, 1.04), (6.94, 2.74, 1.19), 55, 2.2, (6.94, 2.74, 1.15)),
    "ots":       ((7.32, 2.22, 1.36), (6.95, 3.25, 0.86), 35, 2.8, (6.95, 3.18, 0.86)),
    "glass":     ((7.62, 2.70, 0.92), (7.22, 3.18, 0.80), 85, 2.8, (7.25, 3.15, 0.81)),
    "desk34":    ((5.70, 3.95, 1.38), (6.95, 2.85, 0.98), 35, 3.2, (6.95, 2.80, 1.05)),
    "wide":      ((4.95, 0.55, 1.6), (4.15, 5.3, 1.15), 16, None, None),
}


def add_shot_cams():
    c = geo.coll("Shots")
    cams = {}
    for name, (pos, at, mm, fstop, focus) in SHOTS.items():
        data = bpy.data.cameras.new(f"Shot_{name}")
        data.lens = mm
        data.sensor_width = 36
        data.clip_start = 0.02
        if fstop:
            data.dof.use_dof = True
            data.dof.aperture_fstop = fstop
            data.dof.aperture_blades = 0          # round bokeh
            data.dof.aperture_ratio = 1.25        # slightly oval, anamorphic feel
            data.dof.focus_distance = (Vector(focus) - Vector(pos)).length
        obj = bpy.data.objects.new(f"Shot_{name}", data)
        c.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector(at) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        cams[name] = obj
    return cams


def build(preset="3am", look=True, ivan_blend=None):
    scene, _ = shell.build()
    materials.restyle_shell()
    hhmm = {"3am": (3, 4), "4am": (4, 12), "sunrise": (6, 14)}[preset]
    props_desk.build(hhmm)
    if props_story:
        props_story.build(preset)
    if props_clutter:
        props_clutter.build(preset)
    if exterior:
        exterior.build(preset)
    lighting.apply(preset)
    if ivan_blend:
        import cast
        rig = cast.load_ivan(ivan_blend)
        cast.seat_ivan_at_desk(rig)
    cams = add_shot_cams()
    if look:
        lighting.film_look(scene)
    return scene, cams


def render(scene, cams, names, out_dir, res, samples, tag):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.blur_glossy = 1.0
    scene.cycles.sample_clamp_indirect = 8.0
    scene.render.use_sequencer = False
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.image_settings.file_format = "PNG"
    for o in scene.objects:            # the shell's own cameras are not story shots
        pass
    paths = []
    for n in names:
        scene.camera = cams[n]
        scene.render.filepath = str(out_dir / f"{tag}_{n}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


if __name__ == "__main__":
    args = sys.argv[1:]
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)

    def opt(flag, default):
        return args[args.index(flag) + 1] if flag in args else default

    preset = opt("--preset", "3am")
    names = opt("--cams", "establish,ots,glass,desk34").split(",")
    res = tuple(int(v) for v in opt("--res", "1600x800").split("x"))
    samples = int(opt("--samples", "128"))
    scene, cams = build(preset, look="--no-look" not in args, ivan_blend=opt("--ivan", None))
    if "--blend" in args:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f"set_intro_{preset}.blend"))
    print("rendered", render(scene, cams, names, out, res, samples, preset))
