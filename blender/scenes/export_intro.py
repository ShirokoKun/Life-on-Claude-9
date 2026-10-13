"""Export the intro set + Ivan's performance to one GLB for the three.js film engine.

    python -I blender/scenes/export_intro.py OUT.glb --ivan path/to/ivan.blend [--seconds 40]

Blender owns assets, layout and the performance; three.js owns light, lens, camera and render.
Anything three.js can't read is converted here: strand hair -> ribbons, curves -> meshes,
shape keys + masks -> a plain skinned mesh. Lights, volumes and cameras are left out.
"""
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib"), str(HERE.parent / "characters")]

import bpy  # noqa: E402  (first: puts bmesh/mathutils on the path)
import bmesh  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import set_intro  # noqa: E402

FPS = 24
P = "mixamorig:"


# ---------------------------------------------------------------------------------------
# Performance (quaternion-safe keyframing on top of the seated pose)
def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)


def wiggle(pb, base, frame, axis, angle):
    pb.rotation_quaternion = base @ Quaternion(axis, angle)
    pb.keyframe_insert("rotation_quaternion", frame=frame)


def perform(rig, frames):
    """40 s of Ivan in the zone: typing bursts, breathing, a lean-in, a glance, a small win."""
    f0, f1 = 1, frames
    bpy.context.scene.frame_set(f0)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    base = {pb.name: pb.rotation_quaternion.copy() for pb in rig.pose.bones}
    rnd = random.Random(7)
    key_all(rig, f0)
    key_all(rig, f1)
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

    # Typing: bursts of key taps per finger, pauses to read; slows when he reads the dashboard.
    pauses = [(585, 612), (650, 700)]
    for side in ("Left", "Right"):
        for finger in ("Index", "Middle", "Ring", "Pinky"):
            pb = rig.pose.bones.get(f"{P}{side}Hand{finger}1")
            if not pb:
                continue
            b = base[pb.name]
            f = f0 + rnd.randint(0, 6)
            while f < f1 - 4:
                if any(a <= f <= z for a, z in pauses):
                    f += 6
                    continue
                burst = rnd.randint(int(FPS * 1.0), int(FPS * 3.0))
                for k in range(f, min(f1 - 4, f + burst), rnd.randint(3, 6)):
                    if any(a <= k <= z for a, z in pauses):
                        break
                    wiggle(pb, b, k, X, 0.32 * rnd.uniform(0.6, 1.0))
                    wiggle(pb, b, k + 2, X, 0.0)
                f += burst + rnd.randint(int(FPS * 0.2), int(FPS * 0.8))
        hand = rig.pose.bones.get(f"{P}{side}Hand")
        if hand:
            for k in range(f0, f1, 5):
                wiggle(hand, base[hand.name], k, X, 0.035 * math.sin(k * 0.9 + (side == "Left") * 1.7))

    # Breathing (0.27 Hz) on the upper spine.
    sp = rig.pose.bones.get(P + "Spine2")
    for k in range(f0, f1 + 1, 4):
        wiggle(sp, base[sp.name], k, X, -0.012 * math.sin(2 * math.pi * 0.27 * k / FPS))

    # Lean in (excitement) 230-330, settle; nod of satisfaction ~800.
    sp1 = rig.pose.bones.get(P + "Spine1")
    for k in range(f0, f1 + 1, 6):
        lean = 0.0
        if 380 <= k <= 480:                      # leans in as the idea clicks (face shot)
            lean = 0.07 * math.sin(math.pi * (k - 380) / 100)
        wiggle(sp1, base[sp1.name], k, X, lean)
    head = rig.pose.bones.get(P + "Head")
    for k in range(f0, f1 + 1, 4):
        yaw = 0.0
        if 640 <= k <= 740:                      # glance right at the dashboard climbing
            yaw = -0.32 * math.sin(math.pi * (k - 640) / 100)
        nod = 0.0
        if 860 <= k <= 900:                      # small nod: it works
            nod = 0.09 * math.sin(math.pi * (k - 860) / 20)
        drift = 0.012 * math.sin(k * 0.05) + 0.008 * math.sin(k * 0.13)
        q = base[head.name] @ Quaternion(Y, yaw) @ Quaternion(X, nod + drift)
        head.rotation_quaternion = q
        head.keyframe_insert("rotation_quaternion", frame=k)


# ---------------------------------------------------------------------------------------
# Make everything exportable
def bake_body(body):
    """Shape keys + masks -> plain mesh with the same skin weights; re-attach the armature."""
    rig = next((m.object for m in body.modifiers if m.type == "ARMATURE"), None)
    for m in body.modifiers:
        if m.type == "ARMATURE":
            m.show_viewport = False
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    body.shape_key_clear() if body.data.shape_keys else None
    old = body.data
    body.data = me
    body.modifiers.clear()
    if rig:
        a = body.modifiers.new("Armature", "ARMATURE")
        a.object = rig
    bpy.data.meshes.remove(old)


def strands_to_ribbons(obj, width_scale=2.5):
    """Hair curves -> camera-agnostic crossed ribbons (two per strand)."""
    hc = obj.data
    pos = [Vector(p.position) for p in hc.points]
    rad_attr = hc.attributes.get("radius")
    bm = bmesh.new()
    offs = list(hc.curve_offset_data) if hasattr(hc, "curve_offset_data") else None
    starts = [c.first_point_index for c in hc.curves]
    sizes = [c.points_length for c in hc.curves]
    for s, n in zip(starts, sizes):
        pts = pos[s:s + n]
        if n < 2:
            continue
        r = (rad_attr.data[s].value if rad_attr else 0.0001) * width_scale
        tang = (pts[-1] - pts[0]).normalized()
        side = tang.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = tang.cross(Vector((0, 1, 0)))
        side.normalize()
        for sd in (side, tang.cross(side).normalized()):
            prev = None
            for i, p in enumerate(pts):
                w = r * (1 - 0.7 * i / (n - 1))
                a_, b_ = bm.verts.new(p - sd * w), bm.verts.new(p + sd * w)
                if prev:
                    bm.faces.new((prev[0], prev[1], b_, a_))
                prev = (a_, b_)
    me = bpy.data.meshes.new(obj.name + "_Mesh")
    bm.to_mesh(me)
    bm.free()
    m = bpy.data.objects.new(obj.name + "_Mesh", me)
    for c in obj.users_collection:
        c.objects.link(m)
    for mat in hc.materials:
        me.materials.append(mat)
    m.parent, m.parent_type, m.parent_bone = obj.parent, obj.parent_type, obj.parent_bone
    m.matrix_world = obj.matrix_world.copy()
    m.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
    return m


def curves_to_meshes():
    dg = bpy.context.evaluated_depsgraph_get()
    for o in list(bpy.data.objects):
        if o.type == "CURVE":
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
            m = bpy.data.objects.new(o.name + "_M", me)
            for c in o.users_collection:
                c.objects.link(m)
            m.parent, m.parent_type, m.parent_bone = o.parent, o.parent_type, o.parent_bone
            m.matrix_parent_inverse = o.matrix_parent_inverse.copy()
            m.matrix_world = o.matrix_world.copy()
            bpy.data.objects.remove(o, do_unlink=True)


def strands_to_lines(obj, name, step=1):
    """Hair curves -> loose-edge polylines (exported as glTF LINES); three.js grows them into
    camera-facing strands with its own hair shader."""
    hc = obj.data
    pos = [Vector(p.position) for p in hc.points]
    verts, edges = [], []
    for ci, c in enumerate(hc.curves):
        s, n = c.first_point_index, c.points_length
        if ci % step or n < 2:
            continue
        b = len(verts)
        verts += pos[s:s + n]
        edges += [(b + i, b + i + 1) for i in range(n - 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, edges, [])
    me.materials.append(bpy.data.materials.get(name) or bpy.data.materials.new(name))
    m = bpy.data.objects.new(name, me)
    for c in obj.users_collection:
        c.objects.link(m)
    m.parent, m.parent_type, m.parent_bone = obj.parent, obj.parent_type, obj.parent_bone
    m.matrix_world = obj.matrix_world.copy()
    m.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
    return m


STRANDS = {"Ivan_Hair": ("Ivan_HairStrands", 3), "Ivan_Brows": ("Ivan_BrowStrands", 1),
           "Ivan_Lashes": ("Ivan_LashStrands", 1)}


def strip_for_web():
    kill = ("Room_Haze_Volume", "Dust_Motes", "Ivan_HairCards")
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA", "LIGHT_PROBE") or o.name in kill or o.name.startswith(("Light_", "Shot_", "Cam_")):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type == "CURVES":
            if o.name in STRANDS:
                strands_to_lines(o, *STRANDS[o.name])
            bpy.data.objects.remove(o, do_unlink=True)
    curves_to_meshes()


if __name__ == "__main__":
    args = sys.argv[1:]
    out = Path(args[0]).resolve()
    ivan = args[args.index("--ivan") + 1] if "--ivan" in args else None   # none: environment only
    seconds = float(args[args.index("--seconds") + 1]) if "--seconds" in args else 40.0
    frames = int(seconds * FPS)
    scene, cams = set_intro.build("3am", look=False, ivan_blend=ivan)
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, frames
    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    body = bpy.data.objects.get("Ivan_Body")
    if "--bake" in args:
        import bake
        for o in list(bpy.data.objects):                 # no haze/dust in the bake
            if o.name in ("Room_Haze_Volume", "Dust_Motes"):
                bpy.data.objects.remove(o, do_unlink=True)
        curves_to_meshes()                               # cables, wires, lamp arm: bake them too
        bake_dir = out.parent / "bakes"
        small = "--bake-small" in args
        bake.bake_set(bake_dir, sizes={"ARCH": 256, "DESK": 256, "ROOM": 256} if small else None,
                      samples=4 if small else (int(args[args.index("--samples") + 1]) if "--samples" in args else 48))
        if body:
            bake_body(body)
        bake.bake_character_light(bake_dir, samples=4 if small else 48,
                                  sizes={k: 256 for k in bake.CHAR_LIGHT} if small else None,
                                  reuse="--reuse-ivan" in args)
        bpy.ops.wm.save_as_mainfile(filepath=str(out.parent / "intro_baked.blend"))
    elif body:
        bake_body(body)
    if rig:
        perform(rig, frames)
    strip_for_web()
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_apply=True, export_animations=True,
                              export_skins=True, export_morph=False, export_cameras=False, export_lights=False,
                              export_yup=True, export_force_sampling=True, export_frame_range=True,
                              export_extras=True, export_image_format="JPEG", export_jpeg_quality=90,
                              use_mesh_edges=True)
    print("EXPORTED", out, out.stat().st_size / 1e6, "MB")
