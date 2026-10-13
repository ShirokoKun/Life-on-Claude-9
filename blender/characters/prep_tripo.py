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
    for img in bpy.data.images:                          # 8K maps are wasted in a browser; 4K holds close-ups
        if img.size[0] > 4096:
            img.scale(4096, 4096)
    rigid_head(rig, body)
    add_glasses(rig, body)
    return rig, body


def add_glasses(rig, body):
    """Thin round wire frames (the character sheet), fitted to the generated face and parented to the head."""
    import bmesh
    import numpy as np
    head = rig.data.bones[P + "Head"]
    hz = (rig.matrix_world @ head.head_local).z
    top = (rig.matrix_world @ head.tail_local).z if head.children == () else max(
        (rig.matrix_world @ b.tail_local).z for b in rig.data.bones if "HeadTop" in b.name)
    co = np.array([body.matrix_world @ v.co for v in body.data.vertices])
    # eye line from the face profile (model faces -Y): the nose tip is the most forward point of the
    # centre line; the bridge of the nose (most recessed point above it) sits at eye height.
    mid = co[(np.abs(co[:, 0]) < 0.006) & (co[:, 2] > hz) & (co[:, 2] < hz + 0.25)]
    bins = {}
    for x, y, z in mid:
        k = round(z / 0.002)
        bins[k] = min(bins.get(k, 9.0), y)
    zs = sorted(bins)
    tip = min(zs, key=lambda k: bins[k] if k * 0.002 < hz + 0.14 else 9.0)
    above = [k for k in zs if tip < k <= tip + 30]                     # up to 6 cm above the tip
    bridge = max(above, key=lambda k: bins[k])
    eye_z = bridge * 0.002 - 0.004
    print("glasses: nose tip z", tip * 0.002, "bridge z", bridge * 0.002, flush=True)
    band = co[np.abs(co[:, 2] - eye_z) < 0.012]
    face_y = band[np.abs(band[:, 0]) < 0.02][:, 1].min()
    sides = band[(band[:, 1] > face_y) & (band[:, 1] < face_y + 0.12)]
    half_w = np.abs(sides[:, 0]).max()                    # head half-width at the eyes (temple to temple)
    f = half_w / 0.075                                    # this head vs an average adult head
    ipd, lens_r, wire = 0.032 * f, 0.0205 * f, 0.0013 * f
    frames = []
    mat_f = bpy.data.materials.new("Glasses Frame")
    mat_f.use_nodes = True
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.016, 0.014, 1)
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.3
    mat_l = bpy.data.materials.new("Glasses Lens")
    mat_l.use_nodes = True
    bl = mat_l.node_tree.nodes["Principled BSDF"]
    bl.inputs["Transmission Weight"].default_value = 1.0
    bl.inputs["Roughness"].default_value = 0.0
    bl.inputs["IOR"].default_value = 1.02
    centres = []
    for sx in (-1, 1):
        x = sx * ipd
        col = band[np.abs(band[:, 0] - x) < 0.01 * f]
        y = col[:, 1].min() - 0.012 * f                  # model faces -Y: the face is the min-y surface
        centres.append((x, y, eye_z))
    for (x, y, z) in centres:
        bpy.ops.mesh.primitive_torus_add(major_radius=lens_r, minor_radius=wire, major_segments=48, minor_segments=8,
                                         location=(x, y, z), rotation=(math.pi / 2, 0, 0))
        frames.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_cylinder_add(radius=lens_r, depth=0.0008, vertices=48, location=(x, y, z),
                                            rotation=(math.pi / 2, 0, 0))
        lens = bpy.context.active_object
        lens.data.materials.append(mat_l)
        lens.name = "Ivan_GlassesLens"
        frames.append(lens)
    (lx, ly, lz), (rx, ry, rz) = centres

    def tube(p0, p1):
        d = Vector(p1) - Vector(p0)
        bpy.ops.mesh.primitive_cylinder_add(radius=wire * 0.85, depth=d.length, vertices=8,
                                            location=(Vector(p0) + Vector(p1)) / 2,
                                            rotation=Vector((0, 0, 1)).rotation_difference(d).to_euler())
        frames.append(bpy.context.active_object)
    tube((lx + lens_r, ly, lz + 0.15 * lens_r), (rx - lens_r, ry, rz + 0.15 * lens_r))      # bridge
    for (x, y, z), sx in zip(centres, (-1, 1)):                                             # temples to the ears
        ear = (sx * (half_w - 0.004), y + 0.014 * f, z + 0.1 * lens_r)
        tube((x + sx * lens_r, y, z + 0.1 * lens_r), ear)
        tube(ear, (ear[0], ear[1] + 0.085 * f, z - 0.012 * f))
    for o in frames:
        if not o.data.materials:
            o.data.materials.append(mat_f)
    for o in frames:
        if o.name.startswith("Ivan_GlassesLens"):
            continue
        o.name = "Ivan_Glasses"
    mw = {o: o.matrix_world.copy() for o in frames}
    for o in frames:
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = P + "Head"
        bpy.context.view_layer.update()
        o.matrix_world = mw[o]


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
    # reading saccades: the head steps a few millimetres between lines of code, every 0.5-1.5 s
    sac_r = random.Random(23)
    sac, tt = [], 0.0
    while tt < FILM_S + 2:
        sac.append((tt, sac_r.uniform(-0.022, 0.022), sac_r.uniform(-0.012, 0.012)))
        tt += sac_r.uniform(0.5, 1.5)

    def saccade(t):
        i = max(j for j, (t0, _, _) in enumerate(sac) if t0 <= t)
        (t0, y0, p0), (t1, y1, p1) = sac[max(i - 1, 0)], sac[i]
        w = min(1.0, (t - t1) / 0.12)                        # quick 120 ms move, then hold
        w = w * w * (3 - 2 * w)
        return y0 + (y1 - y0) * w, p0 + (p1 - p0) * w

    shoulders = [rig.pose.bones.get(P + n) for n in ("LeftShoulder", "RightShoulder")]
    for k in range(1, frames + 1, 3):                       # shoulders ride the typing rhythm
        t = sec(k)
        for i, sh in enumerate(shoulders):
            if sh:
                e = 0.0 if paused(t) else 1.0
                key(sh, k, base[sh.name] @ Quaternion(Z, e * 0.012 * math.sin(t * 7.3 + i * 2.1) + 0.006 * math.sin(t * 0.7 + i)))
    for k in range(1, frames + 1, 2):
        t = sec(k)
        breath = math.sin(2 * math.pi * 0.26 * t)
        sway = 0.016 * math.sin(2 * math.pi * t / 6.5) + 0.006 * math.sin(2 * math.pi * t / 2.9 + 1.0)
        roll = 0.008 * math.sin(2 * math.pi * t / 8.3 + 0.5)
        lean = 0.08 * smooth_pulse(t, *BEATS["lean_in"])
        back = -0.10 * min(1.0, max(0.0, (t - BEATS["sit_back"][0]) / 1.6))
        key(sp0, k, base[sp0.name] @ Quaternion(X, 0.6 * (lean + back)))
        key(sp1, k, base[sp1.name] @ Quaternion(X, lean + back))
        key(sp2, k, base[sp2.name] @ Quaternion(X, -0.012 * breath + 0.5 * lean) @ Quaternion(Y, sway) @ Quaternion(Z, roll))
        yaw = -0.30 * smooth_pulse(t, *BEATS["glance"])           # toward the second screen (his right)
        nod = 0.10 * smooth_pulse(t, *BEATS["nod"]) - 0.06 * smooth_pulse(t, *BEATS["read_pause"])
        drift = 0.012 * math.sin(t * 1.1) + 0.008 * math.sin(t * 2.9)
        key(neck, k, base[neck.name] @ Quaternion(Y, 0.4 * yaw))
        sy, sp = saccade(t)
        key(head, k, base[head.name] @ Quaternion(Y, 0.6 * yaw + sy - 0.5 * sway) @ Quaternion(X, nod + drift + sp - 0.6 * back))


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
    if "--stand" in a:                                # standing still at x,y facing +Y (scene 2, the doorway)
        import acting
        x, y = (float(v) for v in a[a.index("--stand") + 1].split(","))
        frames = int(float(a[a.index("--seconds") + 1]) * FPS) if "--seconds" in a else 10 * FPS
        rig.rotation_mode = "XYZ"
        rig.rotation_euler = (0, 0, math.pi)
        bpy.context.view_layer.update()
        hips = rig.matrix_world @ rig.pose.bones["mixamorig:Hips"].head
        feet = min((rig.matrix_world @ pb.tail).z for pb in rig.pose.bones if "Toe" in pb.name or "Foot" in pb.name)
        rig.location = (rig.location.x + x - hips.x, rig.location.y + y - hips.y, rig.location.z - feet + 0.01)
        bpy.context.view_layer.update()
        actor = acting.Actor(rig, body)
        actor.calibrate()
        actor.reset_upper()
        actor.calibrate_fingers()
        actor.perform_stand(frames, Vector((x, y + 6.0, 1.75)))
        if "--blend" in a:
            bpy.ops.wm.save_as_mainfile(filepath=a[a.index("--blend") + 1])
        export(rig, a[1], frames)
        sys.exit(0)
    seat(rig)
    if "--v1" in a:                                   # intro v1 (32 s, layered performance)
        frames = int(FILM_S * FPS)
        perform(rig, frames)
    else:                                             # intro v2: per-frame acting (acting.py), 37 s
        import acting
        frames = int((float(a[a.index("--seconds") + 1]) if "--seconds" in a else 37.0) * FPS)
        actor = acting.Actor(rig, body, acting.SCENES[a[a.index("--scene") + 1]] if "--scene" in a else None)
        actor.fast(True)
        actor.calibrate()
        actor.reset_upper()
        actor.posture(0.55, 0.0)
        actor.shoulders(0.0)
        for side, home in (("Left", acting.HOME_L), ("Right", acting.HOME_R)):
            actor.arm_to(side, home)
        actor.calibrate_fingers()
        if "--frames" in a:
            frames = int(a[a.index("--frames") + 1])
        actor.perform(frames)
        if "--events" in a:                        # keystrokes for the engine's live screens
            import json
            with open(a[a.index("--events") + 1], "w") as fh:
                json.dump({"fps": FPS, "keys": [[round(t, 3), s[0], f[0]] for t, s, f in actor.events],
                           "typing": actor.sc["typing"], "gaze": actor.sc["gaze"]}, fh)
    if "--blend" in a:
        bpy.ops.wm.save_as_mainfile(filepath=a[a.index("--blend") + 1])
    export(rig, a[1], frames)
