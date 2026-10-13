"""Bring characters into a set (from their own .blend) and pose them for the shot."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "characters"))
import ivan_pose  # noqa: E402

import geo  # noqa: E402


def load_ivan(blend_path):
    """Append every object from ivan.blend into an 'Ivan' collection; return the rig."""
    coll = geo.coll("Ivan")
    with bpy.data.libraries.load(str(blend_path), link=False) as (src, dst):
        dst.objects = [n for n in src.objects if not n.startswith(("Cam_", "Studio", "Key", "Rim", "Fill"))]
    rig = None
    for o in dst.objects:
        if o is None:
            continue
        coll.objects.link(o)
        if o.type == "ARMATURE":
            rig = o
    return rig


def seat_ivan_at_desk(rig, chair=(6.95, 2.60), seat_top=0.525, laptop_keys_y=3.03, desk_top=0.75):
    """Turn him to face +Y (the desk) and pose him hunched over the laptop."""
    rig.rotation_euler = (0, 0, math.pi)
    bpy.context.view_layer.update()
    cx, cy = chair
    ivan_pose.pose_seated_typing(
        rig,
        hips_world=(cx, cy + 0.02, seat_top + 0.10),
        keys_left=(cx - 0.075, laptop_keys_y, desk_top + 0.03),
        keys_right=(cx + 0.075, laptop_keys_y - 0.01, desk_top + 0.03),
        look_at=(cx, 3.24, 0.88),
    )
    return rig
