"""Animation controls: the knobs a shot animates, plus small 'alive' behaviours.

Everything is keyframed on real Blender data, so it renders in Cycles and exports to glTF as
animation clips for three.js. Typical shot setup:

    import controls as C
    C.screen_life(frames=(1, 240))             # code scrolling, cursor blink, LEDs
    C.typing(rig, frames=(1, 240))             # fingers, wrists, small shoulder shifts
    C.breathing(rig, frames=(1, 240))          # chest rise, 0.25 Hz
    C.head_micro(rig, frames=(1, 240))         # tiny head drift + a slow glance
    C.camera_push(cam, distance=0.12, frames=(1, 240))   # the simple cinematic move
    C.handheld(cam, amount=0.004, frames=(1, 240))

Knobs live as custom properties on one empty, 'SHOT_CONTROLS', so lights can be keyed in one place.
"""
import math
import random

import bpy
from mathutils import Euler, Vector

P = "mixamorig:"


def controls_empty():
    e = bpy.data.objects.get("SHOT_CONTROLS")
    if not e:
        e = bpy.data.objects.new("SHOT_CONTROLS", None)
        bpy.context.scene.collection.objects.link(e)
        for k, v in (("lamp", 1.0), ("screen", 1.0), ("fairy", 1.0), ("haze", 1.0), ("exposure", 0.0)):
            e[k] = v
    return e


def _key_rot(pb, frame):
    pb.keyframe_insert("rotation_quaternion" if pb.rotation_mode == "QUATERNION" else "rotation_euler", frame=frame)


def typing(rig, frames=(1, 240), fps=24, intensity=1.0, seed=1):
    """Fingers tap in bursts (people type in phrases, then pause), wrists bob a little."""
    rnd = random.Random(seed)
    f0, f1 = frames
    for side in ("Left", "Right"):
        for finger in ("Index", "Middle", "Ring"):
            pb = rig.pose.bones.get(f"{P}{side}Hand{finger}1")
            if not pb:
                continue
            pb.rotation_mode = "XYZ"
            base = pb.rotation_euler.copy()
            f = f0
            while f < f1:
                burst = rnd.randint(int(fps * 0.8), int(fps * 2.5))
                for k in range(f, min(f1, f + burst), rnd.randint(3, 5)):
                    pb.rotation_euler = base
                    pb.rotation_euler.x = base.x + 0.25 * intensity * rnd.uniform(0.6, 1.0)
                    pb.keyframe_insert("rotation_euler", frame=k)
                    pb.rotation_euler = base
                    pb.keyframe_insert("rotation_euler", frame=k + 2)
                f += burst + rnd.randint(int(fps * 0.3), int(fps * 1.2))     # pause: reading, thinking
        hand = rig.pose.bones.get(f"{P}{side}Hand")
        if hand:
            hand.rotation_mode = "XYZ"
            base = hand.rotation_euler.copy()
            for k in range(f0, f1 + 1, 6):
                hand.rotation_euler = Euler((base.x + 0.03 * math.sin(k * 0.9 + (side == "Left")), base.y, base.z))
                hand.keyframe_insert("rotation_euler", frame=k)


def breathing(rig, frames=(1, 240), fps=24, rate_hz=0.25, depth=0.012):
    pb = rig.pose.bones.get(P + "Spine2")
    if not pb:
        return
    pb.rotation_mode = "XYZ"
    base = pb.rotation_euler.copy()
    for k in range(frames[0], frames[1] + 1, 3):
        pb.rotation_euler = Euler((base.x - depth * math.sin(2 * math.pi * rate_hz * k / fps), base.y, base.z))
        pb.keyframe_insert("rotation_euler", frame=k)


def head_micro(rig, frames=(1, 240), fps=24, seed=3, glance_at=None):
    """Tiny drifts + one slow glance (e.g. to the untouched glass) mid-shot."""
    rnd = random.Random(seed)
    pb = rig.pose.bones.get(P + "Head")
    if not pb:
        return
    pb.rotation_mode = "XYZ"
    base = pb.rotation_euler.copy()
    f0, f1 = frames
    for k in range(f0, f1 + 1, 8):
        pb.rotation_euler = Euler((base.x + rnd.uniform(-0.01, 0.01), base.y + rnd.uniform(-0.015, 0.015), base.z))
        if glance_at and glance_at[0] <= k <= glance_at[1]:
            pb.rotation_euler.z = base.z + glance_at[2]
        pb.keyframe_insert("rotation_euler", frame=k)


def screen_life(frames=(1, 240), fps=24):
    """Scroll the laptop screen texture (code being written) and blink the router/drive LEDs."""
    mat = bpy.data.materials.get("Laptop Screen")
    if mat:
        nt = mat.node_tree
        tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
        if tex:
            mapping = nt.nodes.new("ShaderNodeMapping")
            coord = nt.nodes.new("ShaderNodeTexCoord")
            nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])
            nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
            for k in range(frames[0], frames[1] + 1, 12):
                mapping.inputs["Location"].default_value[1] = -0.0006 * (k - frames[0])
                mapping.inputs["Location"].keyframe_insert("default_value", index=1, frame=k)
    for name, period in (("LED Green", 9), ("LED Blue", 5)):
        m = bpy.data.materials.get(name)
        if not m:
            continue
        sock = m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
        base = sock.default_value
        rnd = random.Random(period)
        for k in range(frames[0], frames[1] + 1, period):
            sock.default_value = base * (0.15 if rnd.random() < 0.35 else 1.0)
            sock.keyframe_insert("default_value", frame=k)


def fairy_flicker(frames=(1, 240), amount=0.12, seed=8):
    m = bpy.data.materials.get("Fairy Bulb")
    if not m:
        return
    sock = m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    base = sock.default_value
    rnd = random.Random(seed)
    for k in range(frames[0], frames[1] + 1, 4):
        sock.default_value = base * (1 + rnd.uniform(-amount, amount))
        sock.keyframe_insert("default_value", frame=k)


def camera_push(cam, distance=0.12, frames=(1, 240)):
    """The two-keyframe move: start, drift forward along the lens axis, ease in/out."""
    fwd = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
    cam.keyframe_insert("location", frame=frames[0])
    start = cam.location.copy()
    cam.location = start + fwd * distance
    cam.keyframe_insert("location", frame=frames[1])
    cam.location = start


def handheld(cam, amount=0.004, frames=(1, 240), seed=5):
    """Low-frequency noise on rotation: an operator breathing behind the camera."""
    rnd = random.Random(seed)
    base = cam.rotation_euler.copy()
    phase = [rnd.uniform(0, 6.28) for _ in range(3)]
    for k in range(frames[0], frames[1] + 1, 4):
        t = k / 24.0
        cam.rotation_euler = Euler((base.x + amount * math.sin(t * 0.9 + phase[0]),
                                    base.y + amount * 0.5 * math.sin(t * 0.7 + phase[1]),
                                    base.z + amount * math.sin(t * 0.55 + phase[2])))
        cam.keyframe_insert("rotation_euler", frame=k)
    cam.rotation_euler = base
