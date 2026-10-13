"""Ivan's look from the character sheet, built off his own body surface (no downloaded assets).

Garments are body-shell meshes: faces in a region of the body, pushed out along normals with a
per-vertex fit profile (loose torso, bloused hem over a ribbed band, cinched cuffs), drape-smoothed,
thickened and subdivided, then bound to the rig with weights copied from the body, so they pose.
Hair and brows are clumped strand curves (Cycles now; hair cards for three.js later).
"""
import bisect
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
class no_mods:
    """Evaluate the shaped body without modifiers (MPFB's helper mask hides joints and shifts indices)."""

    def __init__(self, obj):
        self.obj = obj

    def __enter__(self):
        self.state = [(m, m.show_viewport) for m in self.obj.modifiers]
        for m, _ in self.state:
            m.show_viewport = False
        bpy.context.view_layer.update()

    def __exit__(self, *a):
        for m, v in self.state:
            m.show_viewport = v
        bpy.context.view_layer.update()


def shaped_coords(body):
    with no_mods(body):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        co = [body.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return co


def landmarks(body):
    co = shaped_coords(body)
    L = {}
    for n in ("neck", "head", "pelvis", "l-shoulder", "r-shoulder", "l-hand", "r-hand", "l-elbow", "r-elbow",
              "l-ankle", "r-ankle", "l-eye", "r-eye", "spine-1", "l-upper-leg", "r-upper-leg", "l-knee", "r-knee",
              "l-foot-1", "r-foot-1", "l-foot-2", "r-foot-2", "l-upperlid", "r-upperlid"):
        g = body.vertex_groups.get(f"joint-{n}")
        if not g:
            continue
        pts = [co[v.index] for v in body.data.vertices if any(gg.group == g.index for gg in v.groups)]
        if pts:
            L[n] = sum(pts, Vector()) / len(pts)
    L["front"] = -1.0 if L["l-eye"].y < L["neck"].y else 1.0       # sign of 'forward' on Y
    return L


# ---------------------------------------------------------------------------------------
# Shell garments
def body_copy(body, name):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(body.matrix_world)
    o = bpy.data.objects.new(name, me)
    body.users_collection[0].objects.link(o)
    return o


def shell(body, name, keep, offset, mat, thickness=0.004, subdiv=1, smooth_iter=12):
    o = body_copy(body, name)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [f for f in bm.faces if not all(keep(v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset(v.co)
    # Smooth every opening (neck, hem, cuffs): face deletion leaves a stair-stepped edge.
    edge_verts = [v for v in bm.verts if v.is_boundary]
    for _ in range(14):
        new = {}
        for v in edge_verts:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                new[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
        for v, c in new.items():
            v.co = c
    o["openings"] = len(edge_verts)
    loops = _boundary_loops(bm)
    bm.to_mesh(o.data)
    bm.free()
    o["_loops"] = [[tuple(p) for p in lp] for lp in loops if len(lp) > 8]
    o.data.materials.clear()
    o.data.materials.append(mat)
    for poly in o.data.polygons:
        poly.material_index = 0
    lap = o.modifiers.new("Relax", "SMOOTH")         # melt away anatomy (nipples, abs) under the fabric
    lap.factor = 0.8
    lap.iterations = max(4, smooth_iter // 2)
    sm = o.modifiers.new("Drape", "CORRECTIVE_SMOOTH")
    sm.factor = 0.9
    sm.iterations = smooth_iter
    sm.use_only_smooth = True
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = -1
    if subdiv:
        geo.subsurf(o, subdiv)
    return geo.smooth(o, 80)


def _boundary_loops(bm):
    """Ordered world positions of each boundary loop (for rib bands)."""
    seen, loops = set(), []
    for v in bm.verts:
        if not v.is_boundary or v in seen:
            continue
        loop, cur, prev = [], v, None
        while cur and cur not in seen:
            seen.add(cur)
            loop.append(cur.co.copy())
            nxt = [e.other_vert(cur) for e in cur.link_edges if e.is_boundary and e.other_vert(cur) is not prev]
            prev, cur = cur, (nxt[0] if nxt else None)
        loops.append(loop)
    return loops


def rib_band(name, garment, near, radius, mat, coll):
    """A rolled rib along the garment opening nearest to `near` (crew neck)."""
    loops = [[Vector(p) for p in lp] for lp in garment.get("_loops", [])]
    if not loops:
        return None
    loop = min(loops, key=lambda lp: (sum(lp, Vector()) / len(lp) - near).length)
    pts = [tuple(p) for p in loop[:: max(1, len(loop) // 40)]]
    pts.append(pts[0])
    return geo.tube(name, pts, radius, mat, coll)


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
    # Bake the weights once, in the rest pose; a live transfer would resample from the posed body.
    bpy.context.view_layer.update()
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_move_to_index(modifier="Weights", index=0)
        bpy.ops.object.modifier_apply(modifier="Weights")
    arm = obj.modifiers.new("Armature", "ARMATURE")
    arm.object = rig
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = mw


def attach_to_bone(obj, rig, bone):
    """Rigid parts (hair, brows, glasses, shoes) ride a bone, keeping their world placement."""
    mw = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


# ---------------------------------------------------------------------------------------
# Materials
def knit(name="Sweater Knit", color=(0.66, 0.66, 0.63)):
    """Fine-gauge cotton jersey: columns of V-stitches + soft fuzz (sheen) + slight translucency."""
    mat = M._new(name)
    k = M.NodeKit(mat)
    p, po = k.pos()
    w = k.node("ShaderNodeTexWave", Scale=300.0, Distortion=0.3, _wave_type="BANDS", _bands_direction="X")
    k.link(p, po, w, "Vector")
    w2 = k.node("ShaderNodeTexWave", Scale=480.0, Distortion=0.2, _wave_type="BANDS", _bands_direction="Z")
    k.link(p, po, w2, "Vector")
    m = k.node("ShaderNodeMath", _operation="MULTIPLY")
    k.link(w, "Fac", m, 0)
    k.link(w2, "Fac", m, 1)
    n = k.node("ShaderNodeTexNoise", Scale=40.0, Detail=4.0)
    k.link(p, po, n, "Vector")
    tone = k.ramp(n, "Fac", [(0.3, tuple(c * 0.94 for c in color)), (0.7, tuple(min(1, c * 1.03) for c in color))])
    k.link(tone, "Color", k.bsdf, "Base Color")
    k.bump(m, 0, strength=0.4, distance=0.001)
    k.set(Roughness=0.95, **{"Sheen Weight": 0.8, "Sheen Roughness": 0.45, "Subsurface Weight": 0.2,
                             "Subsurface Radius": (0.5, 0.5, 0.5), "Subsurface Scale": 0.003})
    return mat


def wool_trousers():
    mat = M._new("Trouser Wool")
    k = M.NodeKit(mat)
    p, po = k.pos()
    tw = k.node("ShaderNodeTexWave", Scale=900.0, Distortion=0.4, _wave_type="BANDS", _bands_direction="DIAGONAL")
    k.link(p, po, tw, "Vector")
    n = k.node("ShaderNodeTexNoise", Scale=20.0, Detail=3.0)
    k.link(p, po, n, "Vector")
    tone = k.ramp(n, "Fac", [(0.3, (0.016, 0.017, 0.022)), (0.7, (0.026, 0.027, 0.034))])
    k.link(tone, "Color", k.bsdf, "Base Color")
    k.bump(tw, "Fac", strength=0.12, distance=0.0005)
    k.set(Roughness=0.78, **{"Sheen Weight": 0.25, "Sheen Roughness": 0.5})
    return mat


def leather_shoes():
    mat = M._new("Shoe Leather Brown")
    k = M.NodeKit(mat)
    p, po = k.pos()
    n = k.node("ShaderNodeTexNoise", Scale=300.0, Detail=6.0)
    k.link(p, po, n, "Vector")
    big = k.node("ShaderNodeTexNoise", Scale=12.0, Detail=2.0)
    k.link(p, po, big, "Vector")
    col = k.ramp(big, "Fac", [(0.3, (0.07, 0.033, 0.016)), (0.7, (0.12, 0.058, 0.028))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(n, "Fac", strength=0.06)
    k.set(Roughness=0.32, **{"Coat Weight": 0.6, "Coat Roughness": 0.12})
    return mat


def hair_material(melanin=0.62, redness=0.14, name="Ivan Hair"):
    mat = M._new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    h = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "MELANIN"
    h.inputs["Melanin"].default_value = melanin
    h.inputs["Melanin Redness"].default_value = redness
    h.inputs["Roughness"].default_value = 0.3
    h.inputs["Radial Roughness"].default_value = 0.35
    h.inputs["Random Roughness"].default_value = 0.2
    if "Random Color" in h.inputs:
        h.inputs["Random Color"].default_value = 0.18
    nt.links.new(h.outputs[0], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------------------------------
def dress_sweater_and_shirt(body, L):
    f = L["front"]
    neck, pel = L["neck"], L["pelvis"]
    hem_z = pel.z - 0.09                        # falls over the belt line, like the sheet
    band_h = 0.055                              # ribbed hem band
    sh = {"l": L["l-shoulder"], "r": L["r-shoulder"]}
    hand = {"l": L["l-hand"], "r": L["r-hand"]}
    sw = abs(sh["l"].x - sh["r"].x) / 2

    def arm_t(co):
        side = "l" if (co.x > 0) == (sh["l"].x > 0) else "r"
        a, b = sh[side], hand[side]
        return (co - a).dot(b - a) / (b - a).length_squared

    def is_arm(co):
        return abs(co.x) > sw * 0.78 and co.z > pel.z

    def keep(co):
        if co.z < hem_z:
            return False
        horiz = Vector((co.x - neck.x, co.y - neck.y)).length
        if co.z > neck.z - 0.022 and horiz < 0.062:
            return False                         # crew-neck opening: a ring around the neck, shoulders stay covered
        if co.z > neck.z - 0.04 and (co.y - neck.y) * f > 0.035 and abs(co.x) < 0.045:
            return False                         # ...dipping a little at the front
        if co.z > neck.z + 0.04:
            return False
        if is_arm(co):
            return arm_t(co) < 0.94
        return True

    def off(co):
        if is_arm(co):
            t = arm_t(co)
            if t > 0.86:
                return 0.005                     # ribbed cuff, snug at the wrist
            return 0.016 + 0.016 * math.sin(min(1, t / 0.86) * math.pi)      # roomy sleeve
        if co.z < hem_z + band_h:
            return 0.006                         # ribbed band
        if co.z < hem_z + band_h + 0.09:
            u = (co.z - hem_z - band_h) / 0.09
            return 0.042 - 0.020 * u             # bloused just above the band
        if co.z > neck.z - 0.06 and Vector((co.x - neck.x, co.y - neck.y)).length < 0.095:
            return 0.006                         # neck rib
        return 0.022                             # boxy, easy fit through the chest

    sweater = shell(body, "Ivan_Sweater", keep, off, knit(), thickness=0.006, smooth_iter=16)
    rib = None                                   # rolled rib: off until it tracks the opening exactly
    if rib:
        rib.data.bevel_resolution = 3

    cotton = M.fabric("Shirt Cotton", (0.80, 0.80, 0.78), 0.7, weave=2500.0, sheen=0.2)

    def keep_collar(co):
        horiz = Vector((co.x - neck.x, co.y - neck.y)).length
        return neck.z - 0.12 < co.z < neck.z + 0.018 and horiz < 0.098      # collar + the shirt showing in the neckline

    collar = shell(body, "Ivan_ShirtCollar", keep_collar,
                   lambda co: 0.0055 if co.z > neck.z - 0.03 else 0.0035, cotton, thickness=0.003, smooth_iter=6)
    pts = []
    for sgn in ():                               # collar tips: off until they sit right on the neckline
        o = collar_point(f"Ivan_CollarPoint_{sgn}", cotton, body.users_collection[0])
        o.location = (neck.x + sgn * 0.03, neck.y + f * 0.066, neck.z - 0.052)
        o.rotation_euler = (math.radians(-62 if f < 0 else 62), 0, math.radians(sgn * 22 + (180 if f > 0 else 0)))
        pts.append(o)
    return sweater, collar, pts


def collar_point(name, mat, coll):
    """Small curved triangular collar tip (local: tip toward -Z, hugging +Y)."""
    bm = bmesh.new()
    rows = []
    for j in range(7):
        v = j / 6
        w = 0.024 * (1 - v) + 0.002
        rows.append([bm.verts.new((u * w, 0.004 * (u * u) - 0.002 * v, -v * 0.048)) for u in (-1, -0.5, 0, 0.5, 1)])
    for j in range(6):
        for i in range(4):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(mat)
    s = o.modifiers.new("Thick", "SOLIDIFY")
    s.thickness = 0.0025
    geo.subsurf(o, 1)
    return geo.smooth(o, 80)


def dress_trousers(body, L):
    pel = L["pelvis"]
    waist_z = pel.z + 0.05
    ank = min(L["l-ankle"].z, L["r-ankle"].z)
    knee = L["l-knee"].z

    def keep(co):
        return ank + 0.005 < co.z < waist_z and abs(co.x) < 0.34

    def off(co):
        if co.z > pel.z - 0.03:
            return 0.008                                             # waistband
        if co.z > knee:
            return 0.018 + 0.010 * (pel.z - co.z) / (pel.z - knee)   # pleated, easy thigh
        return 0.028 + 0.016 * (knee - co.z) / (knee - ank)           # straight wide leg to a slight break

    return shell(body, "Ivan_Trousers", keep, off, wool_trousers(), thickness=0.004, smooth_iter=14)


def shoe_mesh(name, mat, coll):
    """Lofted derby: superellipse sections from heel to toe (local +Y = toe, Z up, origin at heel-bottom)."""
    bm = bmesh.new()
    n_ring, n_len = 28, 18
    Lf = 0.285
    rings = []
    for j in range(n_len + 1):
        t = j / n_len
        y = t * Lf
        width = 0.034 + 0.020 * math.sin(min(1.0, t / 0.72) * math.pi * 0.5) - (0.030 * ((t - 0.72) / 0.28) ** 2 if t > 0.72 else 0)
        height = 0.075 - 0.02 * t if t < 0.45 else 0.066 - 0.038 * ((t - 0.45) / 0.55) ** 1.3
        if t < 0.06:
            width *= 0.75 + 0.25 * t / 0.06
        ring = []
        for i in range(n_ring):
            a = 2 * math.pi * i / n_ring
            c, s = math.cos(a), math.sin(a)
            x = math.copysign(abs(c) ** 0.6, c) * width
            z = (math.copysign(abs(s) ** 0.8, s) * 0.5 + 0.5) * height
            ring.append(bm.verts.new((x, y, max(z, 0.0))))
        rings.append(ring)
    for j in range(n_len):
        for i in range(n_ring):
            bm.faces.new((rings[j][i], rings[j][(i + 1) % n_ring], rings[j + 1][(i + 1) % n_ring], rings[j + 1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(mat)
    geo.subsurf(o, 2)
    return geo.smooth(o, 80)


def dress_shoes(body, L, rig):
    f = L["front"]
    leather = leather_shoes()
    sole_mat = M.plastic("Shoe Sole", (0.025, 0.016, 0.012), 0.6)
    shoes = []
    for side, bone in (("l", "LeftFoot"), ("r", "RightFoot")):
        a = L[f"{side}-ankle"]
        toe = L.get(f"{side}-foot-2", a + Vector((0, f * 0.2, 0)))
        heel = Vector((a.x, a.y - f * 0.06, 0.0))
        dirv = Vector((toe.x - heel.x, toe.y - heel.y, 0)).normalized()
        o = shoe_mesh(f"Ivan_Shoe_{side}", leather, body.users_collection[0])
        o.location = heel + Vector((0, 0, 0.012))
        o.rotation_euler = (0, 0, math.atan2(-dirv.x, dirv.y))
        sole = geo.rounded_slab(f"Ivan_ShoeSole_{side}", (0.10, 0.29, 0.013), 0.045, (0, 0.14, -0.012), sole_mat,
                                body.users_collection[0])
        sole.parent = o
        bpy.context.view_layer.update()
        attach_to_bone(o, rig, "mixamorig:" + bone)
        shoes.append(o)
    return shoes


def hide_covered_skin(body, L):
    """Mask out body faces under the clothes (prevents skin poking through in renders)."""
    pel, neck = L["pelvis"], L["neck"]
    sh = {"l": L["l-shoulder"], "r": L["r-shoulder"]}
    hand = {"l": L["l-hand"], "r": L["r-hand"]}
    co_all = shaped_coords(body)
    g = body.vertex_groups.new(name="covered")
    idx = []
    for v in body.data.vertices:
        co = co_all[v.index]
        horiz = Vector((co.x - neck.x, co.y - neck.y)).length
        if co.z < neck.z - 0.015 or (co.z < neck.z + 0.04 and horiz > 0.09 and abs(co.x - neck.x) > 0.085):
            side = "l" if (co.x > 0) == (sh["l"].x > 0) else "r"
            a, b = sh[side], hand[side]
            t = (co - a).dot(b - a) / (b - a).length_squared
            near_hand = (co - hand[side]).length < 0.14             # hand + fingers (they hang below the pelvis)
            if near_hand or (abs(co.x) > abs(sh[side].x) * 0.75 and t > 0.86):
                continue                                             # forearm under the cuff stays: no wrist gap
            idx.append(v.index)
    g.add(idx, 1.0, "REPLACE")
    m = body.modifiers.new("Hide under clothes", "MASK")
    m.vertex_group = "covered"
    m.invert_vertex_group = True


# ---------------------------------------------------------------------------------------
def _surface_samples(body, group, count):
    """Random points (co, normal) on faces whose verts are all in the vertex group."""
    with no_mods(body):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        gi = body.vertex_groups[group].index
        member = set(v.index for v in body.data.vertices if any(gg.group == gi and gg.weight > 0.5 for gg in v.groups))
        me.calc_loop_triangles()
        tris = [t for t in me.loop_triangles if all(i in member for i in t.vertices)]
        cum, acc = [], 0.0
        for t in tris:
            acc += t.area
            cum.append(acc)
        out = []
        for _ in range(count):
            t = tris[min(len(tris) - 1, bisect.bisect_left(cum, rnd.random() * acc))]
            u, v = rnd.random(), rnd.random()
            if u + v > 1:
                u, v = 1 - u, 1 - v
            a, b, c = (body.matrix_world @ me.vertices[i].co for i in t.vertices)
            out.append((a + (b - a) * u + (c - a) * v, (body.matrix_world.to_3x3() @ t.normal).normalized()))
        ev.to_mesh_clear()
    return out


def _curves(name, strands, radius, mat, coll, tip=0.25):
    hc = bpy.data.hair_curves.new(name)
    hc.add_curves([len(s) for s in strands])
    hc.points.foreach_set("position", [c for s in strands for p in s for c in p])
    rad = hc.attributes.get("radius") or hc.attributes.new("radius", "FLOAT", "POINT")
    vals = []
    for s in strands:
        n = len(s)
        vals += [radius * (1.0 - (1 - tip) * i / (n - 1)) for i in range(n)]
    rad.data.foreach_set("value", vals)
    hc.materials.append(mat)
    o = bpy.data.objects.new(name, hc)
    coll.objects.link(o)
    return o


def grow_hair(body, L, guides=1400, per_guide=26):
    """Short back and sides, longer top combed back and across from a left part, lift at the front.
    Strands grow in clumps around guide strands so it reads as styled hair, not fur."""
    f = L["front"]
    eye = (L["l-eye"] + L["r-eye"]) / 2
    hc = Vector((eye.x, eye.y - f * 0.10, eye.z + 0.01))          # skull centre
    part_x = hc.x + 0.032 * (1 if L["l-eye"].x > hc.x else -1)      # his left

    def in_hairline(co):
        depth = -(co.y - eye.y) * f            # distance behind the eye plane
        if depth < 0.06:
            return co.z > eye.z + 0.074 - 0.012 * min(1.0, abs(co.x) / 0.05)
        if depth < 0.11:
            return co.z > eye.z + 0.035
        return co.z > eye.z - 0.075 + max(0.0, 0.03 - abs(co.x) * 0.2)

    def guide_path(co, nrm):
        top = max(0.0, min(1.0, (co.z - (eye.z + 0.03)) / 0.10))
        front = max(0.0, min(1.0, ((co.y - eye.y) * f + 0.10) / 0.06))     # 1 at the hairline
        small = (co.x - part_x) * (part_x - hc.x) > 0
        length = (0.012 + 0.065 * top ** 1.3 + 0.015 * front * top) * (0.55 if small else 1.0)
        across = Vector((math.copysign(1.0, co.x - part_x), 0, 0))
        small = (co.x - part_x) * (part_x - hc.x) > 0
        back = Vector((0, -f, 0))
        down = Vector((0, 0, -1))
        d = across * (0.25 if small else 0.9 * top) + back * (0.75 - 0.3 * top) + down * (0.3 + 0.7 * (1 - top))
        d.normalize()
        r0 = (co - hc).length
        centre = max(0.0, 1.0 - abs(co.x - hc.x) / 0.065)               # volume only along the crown
        lift_max = 0.002 + (0.009 * top + 0.012 * front * top) * centre * (0.4 if small else 1.0)
        pts, p = [], co.copy()
        seg = 7
        for i in range(seg + 1):
            t = i / seg
            pts.append(p + (p - hc).normalized() * lift_max * math.sin(min(1.0, t * 1.3) * math.pi * 0.5))
            tang = (d - nrm * d.dot(nrm)).normalized()
            p = p + tang * (length / seg)
            p = hc + (p - hc).normalized() * r0
        return pts

    roots = [(co, n) for co, n in _surface_samples(body, "scalp", guides * 3) if in_hairline(co)][:guides]
    crown = [(co, n) for co, n in roots if co.z > eye.z + 0.075]          # edge breakup on top only
    hair_cards(body, crown, [guide_path(co, n) for co, n in crown], hc, width=0.006)
    strands = []
    for co, nrm in roots:
        gp = guide_path(co, nrm)
        for _ in range(per_guide):
            off = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
            off = (off - nrm * off.dot(nrm)) * 0.0035
            clump = rnd.uniform(0.55, 0.9)
            pts = []
            for i, gpnt in enumerate(gp):
                t = i / (len(gp) - 1)
                jitter = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.00035 * t
                pts.append(tuple(gpnt + off * (1.0 - clump * t) + jitter))
            strands.append(pts)
    return _curves("Ivan_Hair", strands, 0.000075, hair_material(), body.users_collection[0])


def hair_cards(body, roots, paths, skull, width=0.0075):
    """Export-friendly hair: one textured ribbon per guide clump (+ a second, rotated, for volume)."""
    from pathlib import Path as _P
    tex = _P(__file__).resolve().parents[1] / "assets" / "textures" / "hair_strands.png"
    mat = M._new("Ivan Hair Cards")
    k = M.NodeKit(mat)
    img = k.node("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(tex), check_existing=True)
    uv = k.node("ShaderNodeTexCoord")
    k.link(uv, "UV", img, "Vector")
    k.link(img, "Alpha", k.bsdf, "Alpha")
    tint = k.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=1.0)
    k.link(img, "Color", tint, 6)
    tint.inputs[7].default_value = (0.16, 0.085, 0.045, 1)
    k.link(tint, 2, k.bsdf, "Base Color")
    k.set(Roughness=0.45, **{"Specular IOR Level": 0.6})
    if hasattr(mat, "blend_method"):
        mat.blend_method = "HASHED"
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    for (co, nrm), path in zip(roots, paths):
        for twist in (0.0, 1.0):
            prev = None
            n = len(path)
            for i, p in enumerate(path):
                t = i / (n - 1)
                tang = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
                out = (p - skull).normalized()
                side = tang.cross(out).normalized()
                if twist:
                    side = (side + out * 0.8).normalized()
                w = width * (1.0 - 0.6 * t)
                lift = out * 0.0012
                a_ = bm.verts.new(p - side * w / 2 + lift)
                b_ = bm.verts.new(p + side * w / 2 + lift)
                if prev:
                    f = bm.faces.new((prev[0], prev[1], b_, a_))
                    for l, uvv in zip(f.loops, ((0, (i - 1) / (n - 1)), (1, (i - 1) / (n - 1)), (1, t), (0, t))):
                        l[uvl].uv = uvv
                prev = (a_, b_)
    # Keep every card vertex at least 3 mm outside the real head (the guide paths ride a sphere,
    # and the skull bulges past it between roots).
    from mathutils.bvhtree import BVHTree
    with no_mods(body):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        hm = ev.to_mesh()
        verts = [body.matrix_world @ v.co for v in hm.vertices]
        polys = [tuple(p.vertices) for p in hm.polygons]
        ev.to_mesh_clear()
    tree = BVHTree.FromPolygons(verts, polys)
    for v in bm.verts:
        d = v.co - skull
        if d.length < 1e-6:
            continue
        hit = tree.ray_cast(skull + d.normalized() * 0.3, -d.normalized(), 0.3)
        if hit[0] is not None:
            surface = (hit[0] - skull).length
            if d.length < surface + 0.003 and surface - d.length < 0.015:
                v.co = skull + d.normalized() * (surface + 0.003 + 0.002 * (v.co.z > skull.z))
    me = bpy.data.meshes.new("Ivan_HairCards")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Ivan_HairCards", me)
    body.users_collection[0].objects.link(o)
    me.materials.append(mat)
    return o


def hair_shell(body, L):
    """The hair volume: scalp region grown outward (quiff on top-front, tight back and sides),
    smoothed into a combed mass. Reliable in any renderer; cards add edge breakup on top."""
    f = L["front"]
    eye = (L["l-eye"] + L["r-eye"]) / 2
    hc = Vector((eye.x, eye.y - f * 0.10, eye.z + 0.01))
    part_x = hc.x + 0.032 * (1 if L["l-eye"].x > hc.x else -1)
    gi = body.vertex_groups["scalp"].index
    co_all = shaped_coords(body)
    scalp = set(v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.3 for g in v.groups))

    def in_hairline(co):
        depth = -(co.y - eye.y) * f
        if depth < 0.06:
            return co.z > eye.z + 0.070 - 0.012 * min(1.0, abs(co.x) / 0.05)
        if depth < 0.11:
            return co.z > eye.z + 0.032
        return co.z > eye.z - 0.08 + max(0.0, 0.03 - abs(co.x) * 0.2)

    def keep(co):
        return in_hairline(co) and (co - hc).length < 0.16

    def off(co):
        top = max(0.0, min(1.0, (co.z - (eye.z + 0.03)) / 0.10))
        front = max(0.0, min(1.0, ((co.y - eye.y) * f + 0.10) / 0.06))
        centre = max(0.0, 1.0 - abs(co.x - part_x) / 0.09)
        return 0.004 + 0.010 * top + 0.010 * front * top * centre      # quiff over the forehead

    mat = M._new("Ivan Hair Shell")
    k = M.NodeKit(mat)
    p, po = k.pos(scale=(260.0, 30.0, 30.0))
    n = k.node("ShaderNodeTexNoise", Scale=1.0, Detail=10.0, Roughness=0.7)
    k.link(p, po, n, "Vector")
    col = k.ramp(n, "Fac", [(0.3, (0.07, 0.035, 0.018)), (0.6, (0.16, 0.085, 0.045)), (0.8, (0.24, 0.14, 0.08))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(n, "Fac", strength=0.5, distance=0.0008)
    k.set(Roughness=0.42, **{"Anisotropic": 0.7, "Sheen Weight": 0.3})
    o = shell(body, "Ivan_HairShell", keep, off, mat, thickness=0.004, subdiv=1, smooth_iter=20)
    return o


def grow_brows(body, L, count=1800):
    f = L["front"]
    strands = []
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    inv = body.matrix_world.inverted()
    for side in ("l", "r"):
        eye = L[f"{side}-eye"]
        out_sign = 1 if eye.x > L["head"].x else -1
        for _ in range(count // 2):
            u = rnd.uniform(-1, 1)                           # -1 inner .. 1 outer
            x = eye.x + out_sign * u * 0.026
            z = eye.z + 0.027 + 0.007 * (1 - u * u) - 0.004 * max(0, u) + rnd.uniform(-0.0032, 0.0032) * (1.2 - 0.5 * u)
            origin = Vector((x, eye.y + f * 0.08, z))
            hit, loc, nrm, _ = ev.ray_cast(inv @ origin, Vector((0, -f, 0)))
            if not hit:
                continue
            loc = body.matrix_world @ loc
            d = Vector((out_sign * (0.9 if u > -0.6 else 0.3), 0, 0.25 if u > -0.6 else 0.9)).normalized()
            Ls = rnd.uniform(0.006, 0.011)
            strands.append([tuple(loc + d * Ls * t / 3 + Vector((0, f * 0.0007 * t, 0))) for t in range(4)])
    return _curves("Ivan_Brows", strands, 0.00005, hair_material(0.62, 0.3, "Ivan Brows"), body.users_collection[0])


def grow_lashes(body, L, per_eye=70):
    """Upper lashes along the lid edge: arc above each eye, curving up and out."""
    f = L["front"]
    strands = []
    for side in ("l", "r"):
        eye = L[f"{side}-eye"]
        lid = L.get(f"{side}-upperlid", eye + Vector((0, f * 0.012, 0.006)))
        out_sign = 1 if eye.x > L["head"].x else -1
        for i in range(per_eye):
            u = i / (per_eye - 1) * 2 - 1
            base = Vector((eye.x + out_sign * u * 0.0135, lid.y + f * 0.003 * (1 - u * u), lid.z + 0.0035 * (1 - u * u)))
            d = Vector((out_sign * u * 0.35, f * 0.9, 0.6)).normalized()
            Ls = 0.007 * (1 - 0.4 * abs(u))
            strands.append([tuple(base + d * Ls * t / 3 + Vector((0, 0, 0.0015 * (t / 3) ** 2))) for t in range(4)])
    return _curves("Ivan_Lashes", strands, 0.00004, hair_material(0.9, 0.1, "Ivan Lashes"), body.users_collection[0], tip=0.1)


def glasses(body, L):
    """Round dark frames, 46 mm lenses, slim profile (sheet + refs)."""
    f = L["front"]
    coll = body.users_collection[0]
    frame = M.plastic("Glasses Frame", (0.012, 0.010, 0.009), 0.2)
    lens = M._new("Glasses Lens")
    k = M.NodeKit(lens)
    k.set(**{"Base Color": (1, 1, 1, 1), "Roughness": 0.0, "Transmission Weight": 1.0, "IOR": 1.02,
             "Coat Weight": 1.0, "Coat Roughness": 0.0, "Coat IOR": 1.6})   # clear, barely refracting, still reflective
    parts, centres = [], {}
    for side in ("l", "r"):
        e = L[f"{side}-eye"]
        c = Vector((e.x * 1.08, e.y + f * 0.030, e.z - 0.002))
        centres[side] = c
        parts.append(geo.torus(f"Glasses_Rim_{side}", 0.0232, 0.0013, c, frame, coll, rot=(90, 0, 0), ring=10, seg=56))
        parts.append(geo.cyl(f"Glasses_Lens_{side}", 0.0230, 0.0012, c - Vector((0, f * 0.0006, 0)), lens, coll, rot=(90, 0, 0), seg=56))
        sgn = 1 if e.x > L["head"].x else -1
        hinge = c + Vector((sgn * 0.0238, 0, 0.003))
        ear = Vector((e.x + sgn * 0.047, e.y - f * 0.095, e.z - 0.008))
        parts.append(geo.tube(f"Glasses_Temple_{side}", [tuple(hinge), tuple(hinge + Vector((sgn * 0.008, -f * 0.03, 0))),
                                                         tuple(ear), tuple(ear + Vector((-sgn * 0.004, -f * 0.014, -0.026)))],
                              0.0009, frame, coll))
    lc, rc = centres["l"], centres["r"]
    mid = (lc + rc) / 2 + Vector((0, f * 0.003, 0.007))
    parts.append(geo.tube("Glasses_Bridge", [tuple(lc + (rc - lc).normalized() * 0.0232), tuple(mid),
                                             tuple(rc + (lc - rc).normalized() * 0.0232)], 0.0011, frame, coll))
    return parts


def dress(body, rig):
    bpy.context.view_layer.update()
    L = landmarks(body)
    sweater, collar, points = dress_sweater_and_shirt(body, L)
    trousers = dress_trousers(body, L)
    shoes = dress_shoes(body, L, rig)
    hair = grow_hair(body, L)
    shell_hair = hair_shell(body, L)
    brows = grow_brows(body, L)
    lashes = grow_lashes(body, L)
    specs = glasses(body, L)
    for o in (sweater, collar, trousers, shell_hair):
        bind(o, body, rig)            # weights must come from the full body, before any skin is masked
    hide_covered_skin(body, L)
    for o in points:
        attach_to_bone(o, rig, "mixamorig:Spine2")
    rib = bpy.data.objects.get("Ivan_NeckRib")
    if rib:
        attach_to_bone(rib, rig, "mixamorig:Spine2")
    cards = bpy.data.objects.get("Ivan_HairCards")
    for o in (hair, brows, lashes, *specs, *( [cards] if cards else [] )):
        attach_to_bone(o, rig, "mixamorig:Head")
    return L
