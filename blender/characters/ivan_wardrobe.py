"""Ivan's look from the character sheet, built off his own body surface (no downloaded assets).

Garments are body-shell meshes: faces in a region of the body, pushed out along normals,
thickened and subdivided, then bound to the rig with weights copied from the body. That keeps
them posable for animation. Hair and brows are strand curves (Cycles now; hair cards for
three.js later).
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector

import geo
import materials as M

rnd = random.Random(30)


# ---------------------------------------------------------------------------------------
# Landmarks
def joint(body, name):
    """World-space centroid of an MPFB joint vertex group (on the shaped mesh)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    gi = body.vertex_groups[name].index
    pts = [body.matrix_world @ me.vertices[v.index].co for v in body.data.vertices
           if any(g.group == gi for g in v.groups) and v.index < len(me.vertices)]
    ev.to_mesh_clear()
    return sum(pts, Vector()) / len(pts)


def landmarks(body):
    L = {n: joint(body, f"joint-{n}") for n in (
        "neck", "head", "pelvis", "l-shoulder", "r-shoulder", "l-hand", "r-hand", "l-elbow", "r-elbow",
        "l-ankle", "r-ankle", "l-eye", "r-eye", "spine-1", "l-upper-leg", "r-upper-leg", "l-knee", "r-knee")}
    L["front"] = -1.0 if L["l-eye"].y < L["neck"].y else 1.0       # sign of 'forward' on Y
    return L


# ---------------------------------------------------------------------------------------
# Shell garments
def body_copy(body, name):
    """Evaluated body (shape keys + helper mask applied) as an editable mesh object."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(body.matrix_world)
    o = bpy.data.objects.new(name, me)
    body.users_collection[0].objects.link(o)
    return o


def shell(body, name, keep, offset, mat, thickness=0.004, subdiv=1):
    o = body_copy(body, name)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    kill = [f for f in bm.faces if not all(keep(v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset(v.co)
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.clear()
    o.data.materials.append(mat)
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = -1
    sol.use_rim = True
    if subdiv:
        geo.subsurf(o, subdiv)
    return geo.smooth(o, 80)


def bind(obj, body, rig):
    """Copy skin weights from the body and follow the armature."""
    dt = obj.modifiers.new("Weights", "DATA_TRANSFER")
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    for g in body.vertex_groups:
        if not obj.vertex_groups.get(g.name):
            obj.vertex_groups.new(name=g.name)
    arm = obj.modifiers.new("Armature", "ARMATURE")   # after the weight transfer in the stack
    arm.object = rig
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = mw


def attach_to_bone(obj, rig, bone):
    """Rigid parts (hair, brows, glasses) ride the head bone, keeping their world placement."""
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


# ---------------------------------------------------------------------------------------
# Materials
def knit(name="Sweater Knit", color=(0.70, 0.69, 0.65)):
    mat = M._new(name)
    k = M.NodeKit(mat)
    p, po = k.pos(scale=(1, 1, 1))
    # Vertical ribs of a jersey knit: 'V' stitches approximated by two offset wave sets.
    w = k.node("ShaderNodeTexWave", Scale=260.0, Distortion=0.3, _wave_type="BANDS", _bands_direction="X")
    k.link(p, po, w, "Vector")
    w2 = k.node("ShaderNodeTexWave", Scale=420.0, Distortion=0.2, _wave_type="BANDS", _bands_direction="Z")
    k.link(p, po, w2, "Vector")
    m = k.node("ShaderNodeMath", _operation="MULTIPLY")
    k.link(w, "Fac", m, 0)
    k.link(w2, "Fac", m, 1)
    n = k.node("ShaderNodeTexNoise", Scale=40.0, Detail=4.0)
    k.link(p, po, n, "Vector")
    tone = k.ramp(n, "Fac", [(0.3, tuple(c * 0.93 for c in color)), (0.7, tuple(min(1, c * 1.03) for c in color))])
    k.link(tone, "Color", k.bsdf, "Base Color")
    k.bump(m, 0, strength=0.45, distance=0.0012)
    k.set(Roughness=0.92, **{"Sheen Weight": 0.6, "Sheen Roughness": 0.35, "Subsurface Weight": 0.15,
                             "Subsurface Radius": (0.4, 0.4, 0.4), "Subsurface Scale": 0.003})
    return mat


def wool_trousers():
    mat = M._new("Trouser Wool")
    k = M.NodeKit(mat)
    p, po = k.pos()
    tw = k.node("ShaderNodeTexWave", Scale=900.0, Distortion=0.4, _wave_type="BANDS", _bands_direction="DIAGONAL")
    k.link(p, po, tw, "Vector")
    k.bump(tw, "Fac", strength=0.12, distance=0.0005)
    k.set(**{"Base Color": (0.022, 0.024, 0.03, 1), "Roughness": 0.85, "Sheen Weight": 0.35})
    return mat


def leather_shoes():
    mat = M._new("Shoe Leather Brown")
    k = M.NodeKit(mat)
    p, po = k.pos()
    n = k.node("ShaderNodeTexNoise", Scale=300.0, Detail=6.0)
    k.link(p, po, n, "Vector")
    col = k.ramp(n, "Fac", [(0.3, (0.10, 0.045, 0.02)), (0.7, (0.2, 0.09, 0.04))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(n, "Fac", strength=0.08)
    k.set(Roughness=0.35, **{"Coat Weight": 0.5, "Coat Roughness": 0.15})
    return mat


def hair_material(melanin=0.42, name="Ivan Hair"):
    mat = M._new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    h = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "MELANIN"
    h.inputs["Melanin"].default_value = melanin
    h.inputs["Melanin Redness"].default_value = 0.45
    h.inputs["Roughness"].default_value = 0.32
    h.inputs["Radial Roughness"].default_value = 0.4
    h.inputs["Random Roughness"].default_value = 0.15
    if "Random Color" in h.inputs:
        h.inputs["Random Color"].default_value = 0.12
    nt.links.new(h.outputs[0], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------------------------------
def dress_sweater_and_shirt(body, L):
    f = L["front"]
    neck, pel = L["neck"], L["pelvis"]
    hem_z = pel.z + 0.02
    sh = {"l": L["l-shoulder"], "r": L["r-shoulder"]}
    hand = {"l": L["l-hand"], "r": L["r-hand"]}
    sw = abs(sh["l"].x - sh["r"].x) / 2

    def on_arm(co):
        side = "l" if (co.x > 0) == (sh["l"].x > 0) else "r"
        a, b = sh[side], hand[side]
        t = (co - a).dot(b - a) / (b - a).length_squared
        return t, side

    def keep(co):
        if co.z < hem_z:
            return False
        if co.z > neck.z - 0.025:
            return False
        # crew neck dips a bit at the front
        if co.z > neck.z - 0.055 and (co.y - neck.y) * f > 0.02 and abs(co.x) < 0.06:
            return False
        t, _ = on_arm(co)
        if abs(co.x) > sw * 0.75:
            return t < 0.93
        return True

    def off(co):
        t, _ = on_arm(co)
        base = 0.008
        if co.z < hem_z + 0.08:
            base += 0.012 * (1 - (co.z - hem_z) / 0.08)       # bloused hem
        if abs(co.x) > sw * 0.75 and t > 0.3:
            base += 0.006                                        # roomy sleeves
        return base

    sweater = shell(body, "Ivan_Sweater", keep, off, knit(), thickness=0.005)

    def keep_collar(co):
        return neck.z - 0.07 < co.z < neck.z - 0.005

    def off_collar(co):
        return 0.004

    collar = shell(body, "Ivan_ShirtCollar", keep_collar, off_collar, M.fabric("Shirt Cotton", (0.82, 0.82, 0.8), 0.7, weave=2500.0, sheen=0.2),
                   thickness=0.003)
    # Collar points sitting on the sweater neckline.
    pts = []
    for s in (-1, 1):
        cx = neck.x + s * 0.038
        p = geo.box(f"Ivan_CollarPoint_{s}", (0.045, 0.002, 0.05), (cx, neck.y + f * 0.055, neck.z - 0.085),
                    collar.data.materials[0], body.users_collection[0], rot=(f * -55, s * -18, s * 28), bev=0.0015)
        pts.append(p)
    return sweater, collar, pts


def dress_trousers_and_shoes(body, L):
    pel = L["pelvis"]
    waist_z = pel.z + 0.06
    ank = min(L["l-ankle"].z, L["r-ankle"].z)

    def keep(co):
        return ank + 0.015 < co.z < waist_z

    def off(co):
        o = 0.009
        if co.z < L["l-knee"].z:
            o += 0.014 * (L["l-knee"].z - co.z) / (L["l-knee"].z - ank)   # straight wide leg
        return o

    trousers = shell(body, "Ivan_Trousers", keep, off, wool_trousers(), thickness=0.004)

    def keep_shoe(co):
        return co.z < ank + 0.04

    def off_shoe(co):
        return 0.007 if co.z > 0.012 else 0.004

    shoes = shell(body, "Ivan_Shoes", keep_shoe, off_shoe, leather_shoes(), thickness=0.006)
    return trousers, shoes


def hide_covered_skin(body, L):
    """Mask out body faces under the clothes (prevents skin poking through in renders)."""
    pel, neck = L["pelvis"], L["neck"]
    sh = {"l": L["l-shoulder"], "r": L["r-shoulder"]}
    hand = {"l": L["l-hand"], "r": L["r-hand"]}
    ank = min(L["l-ankle"].z, L["r-ankle"].z)
    g = body.vertex_groups.new(name="covered")
    idx = []
    for v in body.data.vertices:
        co = body.matrix_world @ v.co
        if ank + 0.06 < co.z < neck.z - 0.07:
            side = "l" if (co.x > 0) == (sh["l"].x > 0) else "r"
            a, b = sh[side], hand[side]
            t = (co - a).dot(b - a) / (b - a).length_squared
            if abs(co.x) > abs(sh[side].x) * 0.75 and t > 0.88:
                continue
            idx.append(v.index)
    g.add(idx, 1.0, "REPLACE")
    m = body.modifiers.new("Hide under clothes", "MASK")
    m.vertex_group = "covered"
    m.invert_vertex_group = True


# ---------------------------------------------------------------------------------------
def _surface_samples(body, group, count):
    """Random points (co, normal) on faces whose verts are all in the vertex group."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    gi = body.vertex_groups[group].index
    member = set(v.index for v in body.data.vertices if any(gg.group == gi and gg.weight > 0.5 for gg in v.groups))
    me.calc_loop_triangles()
    tris = [t for t in me.loop_triangles if all(i in member for i in t.vertices)]
    areas = [t.area for t in tris]
    total = sum(areas)
    out = []
    for _ in range(count):
        r = rnd.random() * total
        acc = 0
        for t, a in zip(tris, areas):
            acc += a
            if acc >= r:
                break
        u, v = rnd.random(), rnd.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        a, b, c = (body.matrix_world @ me.vertices[i].co for i in t.vertices)
        out.append((a + (b - a) * u + (c - a) * v, (body.matrix_world.to_3x3() @ t.normal).normalized()))
    ev.to_mesh_clear()
    return out


def _curves(name, strands, radius, mat, coll):
    hc = bpy.data.hair_curves.new(name)
    hc.add_curves([len(s) for s in strands])
    flat = [c for s in strands for p in s for c in p]
    hc.points.foreach_set("position", flat)
    rad = hc.attributes.get("radius") or hc.attributes.new("radius", "FLOAT", "POINT")
    vals = []
    for s in strands:
        n = len(s)
        vals += [radius * (1.0 - 0.75 * i / (n - 1)) for i in range(n)]
    rad.data.foreach_set("value", vals)
    hc.materials.append(mat)
    o = bpy.data.objects.new(name, hc)
    coll.objects.link(o)
    return o


def grow_hair(body, L, count=26000):
    """Short side-parted cut: part on his left, top swept across, short back and sides."""
    f = L["front"]
    head = L["head"]
    part_x = head.x + 0.028 * (1 if L["l-eye"].x > head.x else -1)   # his left
    strands = []
    for co, nrm in _surface_samples(body, "scalp", count):
        rel = co - head
        top = max(0.0, min(1.0, (co.z - (L["l-eye"].z + 0.03)) / 0.12))
        length = 0.012 + 0.05 * top ** 1.3 + rnd.uniform(-0.004, 0.004)
        # Comb direction: away from the part, a little backward on top, downward on sides/back.
        side = 1.0 if (co.x - part_x) * (1 if part_x > head.x else -1) > 0 else -1.0
        across = Vector((math.copysign(1.0, co.x - part_x), 0, 0))
        back = Vector((0, -f, 0))
        down = Vector((0, 0, -1))
        d = (across * (0.9 if top > 0.6 else 0.3) + back * (0.35 if top > 0.6 else 0.6) + down * (0.2 + 0.8 * (1 - top)))
        if (co.y - head.y) * f > 0.05 and top > 0.5:        # front hairline: lift then sweep
            d += Vector((0, 0, 0.5)) + across * 0.6
        d.normalize()
        pts = []
        p = co.copy()
        lift = 0.002 + 0.006 * top
        seg = 6
        for i in range(seg + 1):
            t = i / seg
            pts.append(tuple(p + nrm * lift * math.sin(t * math.pi * 0.8) + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.0006))
            tang = (d - nrm * d.dot(nrm)).normalized()
            p = p + tang * (length / seg)
            # Follow the skull: pull back toward the head surface
            to_c = (head - p)
            p = p + to_c.normalized() * max(0.0, (p - head).length - (co - head).length - lift) * 0.6
        strands.append(pts)
    return _curves("Ivan_Hair", strands, 0.00009, hair_material(), body.users_collection[0])


def grow_brows(body, L, count=1400):
    f = L["front"]
    strands = []
    for side in ("l", "r"):
        eye = L[f"{side}-eye"]
        for _ in range(count // 2):
            x = eye.x + rnd.uniform(-0.024, 0.024)
            outer = (x - eye.x) * (1 if eye.x > 0 else -1)
            z = eye.z + 0.028 + 0.006 * (1 - (outer / 0.024) ** 2) + rnd.uniform(-0.0035, 0.0035)
            # project onto the face: cast along -forward
            origin = Vector((x, eye.y + f * 0.08, z))
            hit, loc, nrm, _ = body.ray_cast(body.matrix_world.inverted() @ origin, Vector((0, -f, 0)))
            if not hit:
                continue
            loc = body.matrix_world @ loc
            d = Vector((math.copysign(1, eye.x - L["head"].x) * 0.9, 0, 0.25)).normalized()
            L_ = rnd.uniform(0.006, 0.01)
            pts = [tuple(loc + d * L_ * t / 3 + Vector((0, f * 0.0008 * t, 0))) for t in range(4)]
            strands.append(pts)
    return _curves("Ivan_Brows", strands, 0.00006, hair_material(0.5, "Ivan Brows"), body.users_collection[0])


def glasses(body, L):
    """Round dark acetate frames, 46 mm lenses."""
    f = L["front"]
    coll = body.users_collection[0]
    frame = M.plastic("Glasses Acetate", (0.012, 0.009, 0.008), 0.18)
    lens = M.glass("Glasses Lens", (0.97, 0.98, 0.98))
    parts = []
    for side in ("l", "r"):
        e = L[f"{side}-eye"]
        c = Vector((e.x, e.y + f * 0.016, e.z - 0.002))
        parts.append(geo.torus(f"Glasses_Rim_{side}", 0.0235, 0.0018, c, frame, coll, rot=(90, 0, 0), ring=10, seg=48))
        parts.append(geo.cyl(f"Glasses_Lens_{side}", 0.0232, 0.0015, c - Vector((0, f * 0.00075, 0)), lens, coll, rot=(90, 0, 0), seg=48))
        sgn = 1 if e.x > L["head"].x else -1
        hinge = c + Vector((sgn * 0.0245, 0, 0.004))
        ear = Vector((e.x + sgn * 0.018, e.y - f * 0.095, e.z - 0.01))
        parts.append(geo.tube(f"Glasses_Temple_{side}", [tuple(hinge), tuple(hinge + Vector((sgn * 0.006, -f * 0.03, 0))),
                                                         tuple(ear), tuple(ear + Vector((0, -f * 0.012, -0.025)))], 0.0012, frame, coll))
    lc = Vector((L["l-eye"].x, L["l-eye"].y + f * 0.016, L["l-eye"].z))
    rc = Vector((L["r-eye"].x, L["r-eye"].y + f * 0.016, L["r-eye"].z))
    mid = (lc + rc) / 2 + Vector((0, f * 0.004, 0.006))
    parts.append(geo.tube("Glasses_Bridge", [tuple(lc + (rc - lc).normalized() * 0.0235), tuple(mid),
                                             tuple(rc + (lc - rc).normalized() * 0.0235)], 0.0016, frame, coll))
    return parts


def dress(body, rig):
    bpy.context.view_layer.update()
    L = landmarks(body)
    sweater, collar, points = dress_sweater_and_shirt(body, L)
    trousers, shoes = dress_trousers_and_shoes(body, L)
    hair = grow_hair(body, L)
    brows = grow_brows(body, L)
    specs = glasses(body, L)
    hide_covered_skin(body, L)
    for o in (sweater, collar, trousers, shoes, *points):
        bind(o, body, rig)
    head_bone = next((b.name for b in rig.data.bones if b.name.lower().endswith("head")), None)
    for o in (hair, brows, *specs):
        if head_bone:
            attach_to_bone(o, rig, head_bone)
    return L
