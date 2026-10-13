"""Ivan from the provided rigged GLB (Tripo/Mixamo rig) -> seated at the desk with a timed performance.

    python -I blender/characters/prep_tripo.py blender/assets/characters/ivan_meshy.glb engine/assets/ivan.glb
           [--preview out.png --frame N]

The film timeline (engine/src/shots.js) is the source of truth: voiceover starts at VO_OFFSET seconds;
performance beats below are written in film seconds and match the voiceover lines.
"""
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import ivan_pose  # noqa: E402

FPS = 24
FILM_S = 32.0
P = "mixamorig:"
HEIGHT = 1.80
CHAIR, SEAT_TOP, KEYS_Y, DESK_TOP = (6.95, 2.60), 0.525, 3.03, 0.75

# beats in film seconds (voiceover + 1.5 s)
BEATS = {
    "lean_in": (11.4, 15.8),      # "hunched over his laptop, typing furiously"
    "read_pause": (16.3, 17.2),   # stops to read what Claude wrote
    "glance": (17.4, 19.8),       # eyes to the dashboard on the second screen
    "pause2": (24.0, 24.8),
    "nod": (27.6, 28.6),          # "because he realized he could"
    "sit_back": (29.0, 32.0),     # a breath, a half smile
}


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    for o in list(bpy.data.objects):
        if o.type == "MESH" and not o.parent:          # stray helper sphere in the export
            bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    root = rig.parent
    mw = rig.matrix_world.copy()
    rig.parent = None
    rig.matrix_world = mw
    if root:
        bpy.data.objects.remove(root, do_unlink=True)
    top = max((rig.matrix_world @ b.tail_local).z for b in rig.data.bones if "HeadTop" in b.name)
    k = HEIGHT / top
    rig.scale = (k, k, k)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for c in rig.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    meshes = [c for c in rig.children if c.type == "MESH"]
    for m in meshes:                                     # one skinned mesh is cheaper in three.js
        m.select_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "Ivan_Body"
    rig.name = "Ivan_Rig"
    mat = body.material_slots[0].material
    mat.name = "Ivan Tripo"
    rigid_head(rig, body)
    return rig, body


def rigid_head(rig, body):
    """The generated mesh is several pieces (chin, lips, face) with different bone weights, so any
    neck bend tears the mouth open. Everything above the jawline follows the Head bone rigidly,
    blending into the neck over a few centimetres."""
    neck_z = (rig.matrix_world @ rig.data.bones[P + "Neck"].head_local).z
    head_z = (rig.matrix_world @ rig.data.bones[P + "Head"].head_local).z
    lo, hi = neck_z + 0.25 * (head_z - neck_z), neck_z + 0.55 * (head_z - neck_z)
    vg = body.vertex_groups
    hg = vg.get(P + "Head")
    for v in body.data.vertices:
        z = (body.matrix_world @ v.co).z
        if z <= lo:
            continue
        s = min(1.0, (z - lo) / (hi - lo))
        s = s * s * (3 - 2 * s)
        others = [(g.group, g.weight) for g in v.groups if g.group != hg.index]
        cur_h = next((g.weight for g in v.groups if g.group == hg.index), 0.0)
        new_h = max(cur_h, s)
        rest = sum(w for _, w in others)
        for gi, w in others:
            vg[gi].add([v.index], (w / rest) * (1 - new_h) if rest > 0 else 0.0, "REPLACE")
        hg.add([v.index], new_h, "REPLACE")


def seat(rig):
    rig.rotation_mode = "XYZ"                            # glTF import leaves it in quaternion mode
    rig.rotation_euler = (0, 0, math.pi)                 # model faces -Y; the desk is +Y
    bpy.context.view_layer.update()
    cx, cy = CHAIR
    ivan_pose.pose_seated_typing(
        rig,
        hips_world=(cx, cy + 0.07, SEAT_TOP + 0.10),
        keys_left=(cx - 0.085, KEYS_Y, DESK_TOP + 0.03),
        keys_right=(cx + 0.085, KEYS_Y - 0.01, DESK_TOP + 0.03),
        look_at=(cx, 3.24, 0.88),
    )
    # Tripo weights blend the mouth between Neck and Head: keep them nearly co-linear so the
    # face never stretches; the downward look comes from the upper spine instead.
    up = Vector((0, 0, 1))
    fwd = Vector((0, 1, 0))
    ivan_pose.aim(rig, "Spine2", up + fwd * 0.50)
    ivan_pose.aim(rig, "Neck", up + fwd * 0.42)
    ivan_pose.aim(rig, "Head", up + fwd * 0.36)
    for s_, sg in (("Left", 1), ("Right", -1)):           # re-solve the arms after the spine change
        tgt = (cx + (-0.085 if s_ == "Left" else 0.085), KEYS_Y - (0 if s_ == "Left" else 0.01), DESK_TOP + 0.03)
        sh = ivan_pose.world_head(rig, f"{s_}Arm")
        side = Vector((-1, 0, 0)) * sg                   # rig turned to +Y: his left is -X
        pole = sh + side * 0.35 - up * 0.45 - fwd * 0.1
        ivan_pose.two_bone_ik(rig, f"{s_}Arm", f"{s_}ForeArm", tgt, pole)
        ivan_pose.aim(rig, f"{s_}Hand", fwd * 1.0 - up * 0.25 - side * 0.1)


def smooth_pulse(t, a, b):
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2


def perform(rig, frames):
    sc = bpy.context.scene
    sc.frame_set(1)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    base = {pb.name: pb.rotation_quaternion.copy() for pb in rig.pose.bones}
    for pb in rig.pose.bones:                            # hold the seated pose at both ends
        for f in (1, frames):
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("location", frame=f)
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    rnd = random.Random(11)
    sec = lambda f: (f - 1) / FPS
    paused = lambda t: any(a <= t <= b for k, (a, b) in BEATS.items() if k in ("read_pause", "pause2", "sit_back", "nod"))

    def key(pb, f, q):
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=f)

    # fingers: bursts of taps (people type in phrases); the 'furious' line types fastest
    for side in ("Left", "Right"):
        for finger in ("Index", "Middle", "Ring", "Pinky"):
            for j in (1, 2):
                pb = rig.pose.bones.get(f"{P}{side}Hand{finger}{j}")
                if not pb:
                    continue
                b = base[pb.name]
                f = 2 + rnd.randint(0, 5)
                while f < frames - 4:
                    t = sec(f)
                    if paused(t):
                        key(pb, f, b)
                        f += 6
                        continue
                    fast = BEATS["lean_in"][0] <= t <= BEATS["lean_in"][1]
                    burst = rnd.randint(int(FPS * 1.0), int(FPS * (3.5 if fast else 2.4)))
                    step_lo, step_hi = (2, 4) if fast else (3, 6)
                    k = f
                    while k < min(frames - 4, f + burst) and not paused(sec(k)):
                        amt = (0.30 if j == 1 else 0.22) * rnd.uniform(0.55, 1.0)
                        key(pb, k, b @ Quaternion(X, amt))
                        key(pb, k + 1 + (j == 2), b)
                        k += rnd.randint(step_lo, step_hi)
                    f = k + rnd.randint(int(FPS * 0.15), int(FPS * 0.7))
        hand = rig.pose.bones.get(f"{P}{side}Hand")
        fore = rig.pose.bones.get(f"{P}{side}ForeArm")
        for k in range(1, frames + 1, 3):
            t = sec(k)
            w = 0.0 if paused(t) else 1.0
            key(hand, k, base[hand.name] @ Quaternion(X, w * 0.03 * math.sin(k * 0.9 + (side == "Left") * 1.7)))
            key(fore, k, base[fore.name] @ Quaternion(Z, w * 0.012 * math.sin(k * 0.37 + (side == "Left"))))

    sp2 = rig.pose.bones[P + "Spine2"]
    sp1 = rig.pose.bones[P + "Spine1"]
    sp0 = rig.pose.bones[P + "Spine"]
    neck = rig.pose.bones[P + "Neck"]
    head = rig.pose.bones[P + "Head"]
    for k in range(1, frames + 1, 2):
        t = sec(k)
        breath = math.sin(2 * math.pi * 0.26 * t)
        lean = 0.08 * smooth_pulse(t, *BEATS["lean_in"])
        back = -0.10 * min(1.0, max(0.0, (t - BEATS["sit_back"][0]) / 1.6))
        key(sp0, k, base[sp0.name] @ Quaternion(X, 0.6 * (lean + back)))
        key(sp1, k, base[sp1.name] @ Quaternion(X, lean + back))
        key(sp2, k, base[sp2.name] @ Quaternion(X, -0.012 * breath + 0.5 * lean))
        yaw = -0.30 * smooth_pulse(t, *BEATS["glance"])           # toward the second screen (his right)
        nod = 0.10 * smooth_pulse(t, *BEATS["nod"]) - 0.06 * smooth_pulse(t, *BEATS["read_pause"])
        drift = 0.012 * math.sin(t * 1.1) + 0.008 * math.sin(t * 2.9)
        key(neck, k, base[neck.name] @ Quaternion(Y, 0.4 * yaw))
        key(head, k, base[head.name] @ Quaternion(Y, 0.6 * yaw) @ Quaternion(X, nod + drift - 0.6 * back))


def export(rig, out, frames):
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, frames
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_animations=True, export_skins=True,
                              export_force_sampling=True, export_frame_range=True, export_morph=False,
                              export_image_format="JPEG", export_jpeg_quality=92, export_yup=True)
    print("EXPORTED", out, Path(out).stat().st_size / 1e6, "MB", flush=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    rig, body = load(a[0])
    seat(rig)
    frames = int(FILM_S * FPS)
    perform(rig, frames)
    if "--blend" in a:
        bpy.ops.wm.save_as_mainfile(filepath=a[a.index("--blend") + 1])
    export(rig, a[1], frames)
