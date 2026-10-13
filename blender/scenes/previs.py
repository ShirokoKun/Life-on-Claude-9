"""Previs stills for a scene: the set at a lighting preset, Ivan at a frame of his performance (or standing),
and story cameras. Cycles, low samples, denoised.

    python -I blender/scenes/previs.py OUT_DIR --preset day --ivan ivan_v2act.blend --res 960x480 --samples 40 \
        --shot "2.2|100|seat|7.32,2.22,1.36|6.95,3.25,0.86|35|2.8|6.95,3.18,0.90" ...

A shot: name | performance frame | seat or stand@x,y | camera | look-at | mm | f-stop (0 = no DOF) | focus point
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib"), str(HERE.parent / "characters")]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import set_intro  # noqa: E402


def append_ivan(path):
    objs = []
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        dst.objects = list(src.objects)
    coll = bpy.data.collections.new("Ivan")
    bpy.context.scene.collection.children.link(coll)
    rig = None
    for o in dst.objects:
        if o is None or o.type in ("CAMERA", "LIGHT"):
            continue
        coll.objects.link(o)
        objs.append(o)
        if o.type == "ARMATURE":
            rig = o
    return rig, objs


def stand(rig, objs, x, y):
    """Standing still at (x, y), facing +Y, arms down: the performance switched off, arms hung by IK."""
    import acting
    rig.animation_data_clear()
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    rig.rotation_mode = "XYZ"
    rig.rotation_euler = (0, 0, math.pi)
    rig.location = (0, 0, 0)
    bpy.context.view_layer.update()
    feet = min((rig.matrix_world @ pb.head).z for pb in rig.pose.bones)
    hips = rig.pose.bones[[n for n in rig.pose.bones.keys() if n.endswith("Hips")][0]]
    h = rig.matrix_world @ hips.head
    rig.location = (x - h.x, y - h.y, -feet)
    bpy.context.view_layer.update()
    body = next(o for o in objs if o.type == "MESH" and len(o.data.vertices) > 5000)
    actor = acting.Actor(rig, body)
    actor.calibrate()
    for side, sg in (("Left", 1), ("Right", -1)):
        wrist = Vector((x - 0.24 * sg, y + 0.02, 0.86))
        actor.arm_to(side, wrist)
    actor.calibrate_fingers()
    actor.fingers("Left", {}, relax=1.0)
    actor.fingers("Right", {}, relax=1.0)


def camera(name, pos, at, mm, fstop, focus):
    data = bpy.data.cameras.new(name)
    data.lens = mm
    data.sensor_width = 36
    data.clip_start = 0.02
    if fstop:
        data.dof.use_dof = True
        data.dof.aperture_fstop = fstop
        data.dof.aperture_blades = 0
        data.dof.focus_distance = (Vector(focus) - Vector(pos)).length
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (Vector(at) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    return o


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    opt = lambda f, d: args[args.index(f) + 1] if f in args else d  # noqa: E731
    preset = opt("--preset", "day")
    res = tuple(int(v) for v in opt("--res", "960x480").split("x"))
    samples = int(opt("--samples", "40"))
    shots = [args[i + 1] for i, a in enumerate(args) if a == "--shot"]
    scene, _ = set_intro.build(preset, look=True)
    rig, objs = append_ivan(opt("--ivan", ""))
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = "PNG"
    for spec in shots:
        name, frame, pose, pos, at, mm, fstop, focus = spec.split("|")
        vec = lambda s: tuple(float(v) for v in s.split(","))  # noqa: E731
        if pose.startswith("stand@"):
            stand(rig, objs, *vec(pose[6:]))
        else:
            sc.frame_set(int(frame))
        cam = camera(f"Previs_{name}", vec(pos), vec(at), float(mm), float(fstop), vec(focus))
        sc.camera = cam
        sc.render.filepath = str(out / f"{preset}_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", sc.render.filepath, flush=True)
