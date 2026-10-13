"""Posing Ivan's Mixamo-compatible rig by aiming bones in world space (no keyframed library needed).

pose_relaxed(rig)                          arms down, slight forward head: the character-sheet stance
pose_seated_typing(rig, seat, keys, look)  hunched over the laptop at 3 AM, hands on the keys

Every pose is a dict of bone -> world direction, applied parent-first, plus 2-bone IK for arms.
These same helpers drive animation later (keyframe the dicts over time).
"""
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

P = "mixamorig:"


def _upd():
    bpy.context.view_layer.update()


def aim(rig, bone, world_dir, roll_keep=True):
    """Rotate a pose bone about its head so it points along world_dir."""
    pb = rig.pose.bones[P + bone]
    pb.rotation_mode = "QUATERNION"
    to_arm = rig.matrix_world.to_3x3().inverted()
    want = (to_arm @ Vector(world_dir)).normalized()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(want)
    m = pb.matrix.copy()
    head = m.to_translation()
    rot = q.to_matrix().to_4x4()
    pb.matrix = Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ m
    _upd()


def world_head(rig, bone):
    return rig.matrix_world @ rig.pose.bones[P + bone].head


def length(rig, bone):
    return rig.pose.bones[P + bone].length * rig.matrix_world.to_scale().x


def two_bone_ik(rig, upper, lower, target, pole):
    """Place upper/lower so the lower bone's tail lands on target; elbow bends toward pole."""
    a, b = length(rig, upper), length(rig, lower)
    s = world_head(rig, upper)
    t = Vector(target)
    d = t - s
    dist = min(d.length, (a + b) * 0.999)
    d.normalize()
    # elbow distance along d and height off the line (law of cosines)
    x = (a * a - b * b + dist * dist) / (2 * dist)
    h = math.sqrt(max(a * a - x * x, 0.0))
    pv = (Vector(pole) - s)
    pv = (pv - d * pv.dot(d)).normalized()
    elbow = s + d * x + pv * h
    aim(rig, upper, elbow - s)
    aim(rig, lower, t - world_head(rig, lower))


def curl_fingers(rig, side, amount=0.35):
    for f in ("Index", "Middle", "Ring", "Pinky"):
        for j in (1, 2, 3):
            pb = rig.pose.bones.get(f"{P}{side}Hand{f}{j}")
            if pb:
                pb.rotation_mode = "XYZ"
                pb.rotation_euler.x = amount * (0.6 + 0.2 * j)
    _upd()


def reset(rig):
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    _upd()


# ---------------------------------------------------------------------------------------
def pose_relaxed(rig):
    """Character sheet: arms hang, slight forward head, weight even."""
    reset(rig)
    fwd = Vector((0, -1, 0)) if rig.matrix_world.to_3x3() @ Vector((0, 1, 0)) == Vector((0, 1, 0)) else Vector((0, 1, 0))
    fwd = (rig.matrix_world.to_3x3() @ Vector((0, -1, 0))).normalized()
    side = (rig.matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized()
    for s, sg in (("Left", 1), ("Right", -1)):
        aim(rig, f"{s}Arm", Vector((0, 0, -1)) + side * sg * 0.17 + fwd * 0.02)
        aim(rig, f"{s}ForeArm", Vector((0, 0, -1)) + side * sg * 0.08 + fwd * 0.12)
        aim(rig, f"{s}Hand", Vector((0, 0, -1)) + side * sg * 0.02 + fwd * 0.10)
        curl_fingers(rig, s, 0.18)
    aim(rig, "Neck", Vector((0, 0, 1)) + fwd * 0.18)
    aim(rig, "Head", Vector((0, 0, 1)) + fwd * 0.05)


def pose_seated_typing(rig, hips_world, keys_left, keys_right, look_at):
    """Hunched at the desk: lean in, shoulders round, head down toward the screen, hands on the keys."""
    reset(rig)
    M3 = rig.matrix_world.to_3x3()
    fwd = (M3 @ Vector((0, -1, 0))).normalized()       # the rig was built facing -Y
    side = (M3 @ Vector((1, 0, 0))).normalized()
    up = Vector((0, 0, 1))
    # Move the whole rig so the hips sit on the chair.
    hips = rig.pose.bones[P + "Hips"]
    cur = rig.matrix_world @ hips.head
    rig.location += Vector(hips_world) - cur
    _upd()
    # Legs: thighs forward, shins down, feet flat.
    for s, sg in (("Left", 1), ("Right", -1)):
        aim(rig, f"{s}UpLeg", fwd * 1.0 + side * sg * 0.12 - up * 0.08)
        aim(rig, f"{s}Leg", -up * 1.0 + fwd * 0.12)
        aim(rig, f"{s}Foot", fwd * 1.0 - up * 0.55)
    # Spine: forward lean, rounding up the back (the 3 AM hunch).
    aim(rig, "Spine", up + fwd * 0.20)
    aim(rig, "Spine1", up + fwd * 0.30)
    aim(rig, "Spine2", up + fwd * 0.42)
    aim(rig, "Neck", up + fwd * 0.50)
    head = world_head(rig, "Head")
    d = (Vector(look_at) - head).normalized()
    aim(rig, "Head", (up * 1.0 + d * 0.45))
    # Arms: 2-bone IK to the keys, elbows out and down.
    for s, sg, tgt in (("Left", 1, keys_left), ("Right", -1, keys_right)):
        aim(rig, f"{s}Shoulder", side * sg * 1.0 + fwd * 0.18 - up * 0.05)
        sh = world_head(rig, f"{s}Arm")
        pole = sh + side * sg * 0.35 - up * 0.45 - fwd * 0.1
        two_bone_ik(rig, f"{s}Arm", f"{s}ForeArm", tgt, pole)
        aim(rig, f"{s}Hand", fwd * 1.0 - up * 0.25 - side * sg * 0.1)
        curl_fingers(rig, s, 0.45)
