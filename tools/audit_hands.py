"""Audit Ivan's hands in an exported performance, frame by frame, on the skinned mesh.

    python -I tools/audit_hands.py engine/assets/ivan.glb [engine/scenes/s02/ivan.glb ...] [--step 1] [--json out.json]

Per frame and per hand it measures:
  into_head   hand/finger vertices inside his head or neck (nearest head vertex, signed along its normal), mm
  into_body   the same against the torso and legs, mm
  wrist_bend  angle between forearm and hand, degrees (> 75 reads as a broken wrist)
  wrist_twist the hand's roll about its own axis relative to the forearm, from rest, degrees (> 80 reads as a
              reversed hand: the skin wraps like a candy wrapper)
  elbow_twist the forearm's roll relative to the upper arm, degrees
  desk        hand vertices below the surface under them (keys, laptop, mouse, desk), mm
and prints the frame ranges where a limit is crossed.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

P = "mixamorig:"
LIM = {"into_head": 4.0, "into_body": 8.0, "wrist_bend": 75.0, "wrist_twist": 80.0, "elbow_twist": 110.0, "desk": 3.0}
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "blender" / "characters"))
from acting import surface_z  # noqa: E402  (the same desk the acting solves against)


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = max((o for o in bpy.data.objects if o.type == "MESH" and o.find_armature() == rig), key=lambda o: len(o.data.vertices))
    act = rig.animation_data.action if rig.animation_data else None
    f0, f1 = (int(act.frame_range[0]), int(act.frame_range[1])) if act else (1, 1)
    return rig, body, f0, f1


def regions(body):
    """Dominant deform group per vertex -> region name."""
    names = {g.index: g.name for g in body.vertex_groups}
    out = {"L": [], "R": [], "head": [], "body": []}
    for v in body.data.vertices:
        if not v.groups:
            continue
        g = max(v.groups, key=lambda x: x.weight)
        n = names[g.group].replace(P, "")
        if n.startswith("LeftHand"):
            out["L"].append(v.index)
        elif n.startswith("RightHand"):
            out["R"].append(v.index)
        elif n.startswith(("Head", "Neck")):
            out["head"].append(v.index)
        elif n.startswith(("Spine", "Hips", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg")):
            out["body"].append(v.index)
    return out


def twist(rig, child, parent):
    """Roll of child about its own axis relative to parent, compared with the rest pose (degrees)."""
    c, p = rig.pose.bones[P + child], rig.pose.bones[P + parent]
    rest = p.bone.matrix_local.inverted() @ c.bone.matrix_local
    pose = p.matrix.inverted() @ c.matrix
    q = (rest.inverted() @ pose).to_quaternion()
    return abs(math.degrees(2 * math.atan2(q.y, q.w)) + 180) % 360 - 180   # bone axis is local Y


def penetration(tree, normals, pts, step=2):
    worst = 0.0
    for p in pts[::step]:
        co, i, d = tree.find(p)
        if d > 0.04:
            continue
        depth = -(p - co).dot(normals[i])
        worst = max(worst, depth)
    return worst * 1000


def audit(path, step=1):
    rig, body, f0, f1 = load(path)
    reg = regions(body)
    sc = bpy.context.scene
    rows = []
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        mw = body.matrix_world
        co = [mw @ v.co for v in me.vertices]
        nrm = [(mw.to_3x3() @ v.normal).normalized() for v in me.vertices]
        trees = {}
        for r in ("head", "body"):
            t = KDTree(len(reg[r]))
            for k, i in enumerate(reg[r]):
                t.insert(co[i], k)
            t.balance()
            trees[r] = (t, [nrm[i] for i in reg[r]])
        row = {"frame": f, "t": round((f - f0) / 24, 3)}
        for s, side in (("L", "Left"), ("R", "Right")):
            pts = [co[i] for i in reg[s]]
            row[f"{s}.into_head"] = round(penetration(*trees["head"], pts), 1)
            row[f"{s}.into_body"] = round(penetration(*trees["body"], pts), 1)
            fa, h = rig.pose.bones[P + f"{side}ForeArm"], rig.pose.bones[P + f"{side}Hand"]
            dfa = (rig.matrix_world.to_3x3() @ (fa.tail - fa.head)).normalized()
            dh = (rig.matrix_world.to_3x3() @ (h.tail - h.head)).normalized()
            row[f"{s}.wrist_bend"] = round(math.degrees(dfa.angle(dh)), 1)
            row[f"{s}.wrist_twist"] = round(twist(rig, f"{side}Hand", f"{side}ForeArm"), 1)
            row[f"{s}.elbow_twist"] = round(twist(rig, f"{side}ForeArm", f"{side}Arm"), 1)
            below = 0.0
            for p in pts[::2]:
                if 6.6 < p.x < 7.5 and 2.8 < p.y < 3.5:      # over the desk
                    below = max(below, (surface_z(p.x, p.y) - p.z) * 1000)
            row[f"{s}.desk"] = round(below, 1)
        ev.to_mesh_clear()
        rows.append(row)
    return rows


def spans(rows, key, lim):
    out, cur = [], None
    for r in rows:
        bad = r[key] > lim
        if bad and cur is None:
            cur = [r["t"], r["t"], r[key]]
        elif bad:
            cur[1] = r["t"]; cur[2] = max(cur[2], r[key])
        elif cur:
            out.append(cur); cur = None
    if cur:
        out.append(cur)
    return out


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    step = int(args[args.index("--step") + 1]) if "--step" in args else 1
    out = args[args.index("--json") + 1] if "--json" in args else None
    files = [a for a in args if a.endswith(".glb")]
    report = {}
    for path in files:
        rows = audit(path, step)
        report[path] = {"rows": rows, "issues": {}}
        print(f"\n== {path}  ({len(rows)} frames)")
        for s in ("L", "R"):
            for k, lim in LIM.items():
                sp = spans(rows, f"{s}.{k}", lim)
                if sp:
                    report[path]["issues"][f"{s}.{k}"] = sp
                    print(f"  {s}.{k:<12} > {lim:g}: " + ", ".join(f"{a:.2f}-{b:.2f}s (max {m:.0f})" for a, b, m in sp))
        for s in ("L", "R"):
            mx = {k: max(r[f"{s}.{k}"] for r in rows) for k in LIM}
            print(f"  {s} max: " + "  ".join(f"{k} {v:.0f}" for k, v in mx.items()))
    if out:
        Path(out).write_text(json.dumps(report))
