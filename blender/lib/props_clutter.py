"""Lived-in layer: the mess and life of a developer's flat after two days of building.

References: reference/ours/round3/ (lofi dev room, 'Birdcage' T5ART still, desk clutter refs).
Rules: everything has a reason to be there; clutter collects near where Ivan works and thins out
with distance; organic shapes (plants, cloth, cables, paper) break the hard architecture.
"""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

import geo
import materials as M

TEX = Path(__file__).resolve().parents[1] / "assets" / "textures"
TOP = 0.75
rnd = random.Random(77)


def _mats():
    g = bpy.data.materials.get
    return {
        "monitor": M.plastic("Monitor Black", (0.012, 0.012, 0.014), 0.35),
        "monitor_screen": M.emission("Monitor Screen", (1, 1, 1), 2.4, TEX / "monitor_screen.png"),
        "felt": M.fabric("Desk Mat Felt", (0.03, 0.032, 0.035), 0.95, weave=1500.0),
        "paper": M.paint("Printer Paper", (0.80, 0.79, 0.76), 0.85),
        "paper_print": M.image_mat("Printout", TEX / "printout.png", 0.85),
        "cardboard": _cardboard(),
        "tape": M.plastic("Packing Tape", (0.55, 0.42, 0.22), 0.25),
        "can_red": M.brushed_metal("Can Red", (0.6, 0.05, 0.04), 0.22, 0.3),
        "can_green": M.brushed_metal("Can Green", (0.15, 0.45, 0.12), 0.22, 0.3),
        "headphone": M.plastic("Headphones", (0.02, 0.02, 0.022), 0.4),
        "cushion": M.fabric("Ear Cushion", (0.03, 0.03, 0.03), 0.9, weave=900.0),
        "duck": M.plastic("Rubber Duck", (0.9, 0.62, 0.05), 0.3),
        "duck_beak": M.plastic("Duck Beak", (0.9, 0.3, 0.05), 0.3),
        "steel": g("Black Steel") or M.paint("Black Steel", (0.02, 0.02, 0.022), 0.38),
        "shelf_wood": M.walnut("Shelf Oak", (0.30, 0.20, 0.12), (0.46, 0.33, 0.20)),
        "shelf_white": M.paint("Shelf White", (0.70, 0.69, 0.66), 0.45),
        "speaker": M.plastic("Speaker Body", (0.05, 0.05, 0.055), 0.4),
        "speaker_cone": M.plastic("Speaker Cone", (0.015, 0.015, 0.015), 0.7),
        "bulb": M.emission("Fairy Bulb", (1.0, 0.62, 0.28), 30.0),
        "wire": M.plastic("Fairy Wire", (0.04, 0.035, 0.03), 0.4),
        "leaf": _leaf("Leaf Monstera", (0.035, 0.11, 0.03)),
        "leaf_pothos": _leaf("Leaf Pothos", (0.08, 0.17, 0.04)),
        "leaf_snake": _leaf("Leaf Snake", (0.05, 0.12, 0.05), stripes=True),
        "stem": M.paint("Plant Stem", (0.05, 0.10, 0.03), 0.6),
        "pot_white": M.ceramic("Pot White", (0.72, 0.70, 0.66), 0.4),
        "pot_terra": M.ceramic("Pot Terracotta", (0.48, 0.24, 0.14), 0.75),
        "soil": g("Soil") or M.paint("Soil", (0.05, 0.035, 0.02), 0.95),
        "hoodie": M.fabric("Hoodie Charcoal", (0.05, 0.055, 0.065), 0.95, weave=700.0),
        "sock": M.fabric("Sock Grey", (0.25, 0.25, 0.26), 0.95, weave=600.0),
        "bag": M.fabric("Backpack", (0.05, 0.08, 0.12), 0.85, weave=900.0),
        "bottle": M.glass("Water Bottle", (0.85, 0.92, 0.95), 0.05),
        "fan_white": M.plastic("Fan White", (0.75, 0.75, 0.73), 0.35),
        "binder": M.plastic("Binder Black", (0.03, 0.03, 0.035), 0.5),
        "binder_blue": M.plastic("Binder Blue", (0.05, 0.12, 0.3), 0.5),
        "drive": M.brushed_metal("Hard Drive", (0.25, 0.25, 0.27), 0.3, 0.3),
        "led_blue": M.emission("LED Blue", (0.2, 0.45, 1.0), 20.0),
        "cork": _cork(),
        "pin": M.plastic("Pin Red", (0.7, 0.05, 0.05), 0.3),
        "sticky_y": M.paint("Sticky Yellow", (0.95, 0.80, 0.25), 0.9),
        "sticky_p": M.paint("Sticky Pink", (0.95, 0.45, 0.55), 0.9),
        "sticky_b": M.paint("Sticky Blue", (0.45, 0.75, 0.9), 0.9),
        "wrapper": M.brushed_metal("Snack Wrapper", (0.85, 0.35, 0.08), 0.25, 0.0),
        "trash_bag": M.plastic("Trash Bag", (0.01, 0.01, 0.012), 0.25),
    }


def _cardboard():
    mat = M._new("Cardboard")
    k = M.NodeKit(mat)
    p, po = k.pos()
    n = k.node("ShaderNodeTexNoise", Scale=30.0, Detail=6.0)
    k.link(p, po, n, "Vector")
    col = k.ramp(n, "Fac", [(0.3, (0.32, 0.21, 0.11)), (0.7, (0.42, 0.29, 0.16))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(n, "Fac", strength=0.1)
    k.set(Roughness=0.9)
    return mat


def _cork():
    mat = M._new("Cork")
    k = M.NodeKit(mat)
    p, po = k.pos()
    v = k.node("ShaderNodeTexVoronoi", Scale=400.0)
    k.link(p, po, v, "Vector")
    col = k.ramp(v, "Distance", [(0.0, (0.22, 0.13, 0.06)), (0.5, (0.42, 0.28, 0.15))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(v, "Distance", strength=0.2)
    k.set(Roughness=0.95)
    return mat


def _leaf(name, color, stripes=False):
    """Leaves glow when backlit (translucency), which sells 'alive' in night light."""
    mat = M._new(name)
    k = M.NodeKit(mat)
    tc = k.node("ShaderNodeTexCoord")
    vein = k.node("ShaderNodeTexWave", Scale=8.0 if not stripes else 3.0, Distortion=2.0,
                  _wave_type="BANDS", _bands_direction="X" if not stripes else "Y")
    k.link(tc, "UV", vein, "Vector")
    col = k.ramp(vein, "Fac", [(0.0, tuple(c * 0.75 for c in color)), (0.5, color), (1.0, tuple(min(1, c * 1.3) for c in color))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.set(Roughness=0.38, **{"Subsurface Weight": 0.0, "Coat Weight": 0.25, "Coat Roughness": 0.2})
    tr = k.node("ShaderNodeBsdfTranslucent", Color=(color[0] * 2.2, color[1] * 2.6, color[2] * 1.5, 1))
    mix = k.node("ShaderNodeMixShader", Fac=0.32)
    k.nt.links.remove(k.out.inputs["Surface"].links[0])
    k.link(k.bsdf, "BSDF", mix, 1)
    k.link(tr, "BSDF", mix, 2)
    k.link(mix, "Shader", k.out, "Surface")
    return mat


# ---------------------------------------------------------------------------------------
# Organic generators
def leaf_mesh(name, length, width, curl, droop, mat, coll, split=False):
    """A leaf as a curved, tapered surface: midrib arc + side curl. UV: u across, v along."""
    bm = bmesh.new()
    nu, nv = 9, 14
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rows = []
    for j in range(nv + 1):
        v = j / nv
        half = width * 0.5 * math.sin(math.pi * min(1.0, v * 1.08)) ** 0.8
        row = []
        for i in range(nu + 1):
            u = i / nu * 2 - 1
            x = u * half
            if split and 0.25 < v < 0.9 and abs(u) > 0.35:
                x *= 1.0 + 0.08 * math.sin(v * 40)          # ragged edge for monstera fenestrations
            y = v * length
            z = -droop * v * v * length + curl * (u * u) * half
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            for l, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                l[uv_layer].uv = (ii / nu, jj / nv)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(mat)
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = 0.0015
    return geo.smooth(o, 80)


def plant(name, base, m, c, kind="monstera", scale=1.0, pot="pot_white"):
    """Potted plant: pot + soil + stems + leaves arranged in a loose rosette."""
    x, y, z = base
    pr = 0.16 * scale if kind != "pothos" else 0.07
    ph = 0.30 * scale if kind != "pothos" else 0.09
    geo.lathe(f"{name}_Pot", [(0, 0), (pr * 0.8, 0), (pr, ph), (pr * 0.94, ph), (pr * 0.74, 0.012), (0, 0.012)],
              (x, y, z), m[pot], c, seg=40)
    geo.cyl(f"{name}_Soil", pr * 0.93, 0.004, (x, y, z + ph - 0.02), m["soil"], c, seg=32)
    leaves = []
    if kind == "monstera":
        for i in range(9):
            a = i / 9 * 2 * math.pi + rnd.uniform(-0.3, 0.3)
            h = rnd.uniform(0.35, 0.95) * scale
            r = rnd.uniform(0.15, 0.35) * scale
            tip = Vector((x + math.cos(a) * r, y + math.sin(a) * r, z + ph + h))
            geo.tube(f"{name}_Stem_{i}", [(x, y, z + ph - 0.01), (x + math.cos(a) * r * 0.3, y + math.sin(a) * r * 0.3, z + ph + h * 0.6),
                                          tuple(tip)], 0.006 * scale, m["stem"], c)
            L = rnd.uniform(0.28, 0.42) * scale
            lf = leaf_mesh(f"{name}_Leaf_{i}", L, L * 0.85, 0.25, 0.25, m["leaf"], c, split=True)
            lf.location = tip
            lf.rotation_euler = (math.radians(rnd.uniform(10, 40)), 0, a - math.pi / 2)
            leaves.append(lf)
    elif kind == "snake":
        for i in range(11):
            a = rnd.uniform(0, 2 * math.pi)
            L = rnd.uniform(0.35, 0.75) * scale
            lf = leaf_mesh(f"{name}_Blade_{i}", L, 0.06 * scale, 0.4, rnd.uniform(-0.05, 0.08), m["leaf_snake"], c)
            lf.location = (x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, z + ph - 0.02)
            lf.rotation_euler = (math.radians(rnd.uniform(-95, -75)), 0, a)
            leaves.append(lf)
    elif kind == "pothos":
        # trailing vines down over the shelf edge
        for v in range(4):
            a = rnd.uniform(-0.6, 0.6) + (math.pi * 1.5)
            pts = [(x, y, z + ph)]
            for s in range(1, 6):
                pts.append((x + math.cos(a) * 0.05 * s, y + math.sin(a) * 0.02 * s + 0.03 * s * 0.0,
                            z + ph + 0.02 - 0.09 * s ** 1.3 * 0.5))
            geo.tube(f"{name}_Vine_{v}", pts, 0.002, m["stem"], c)
            for s, p in enumerate(pts[1:]):
                lf = leaf_mesh(f"{name}_Leaf_{v}_{s}", 0.06, 0.05, 0.3, 0.2, m["leaf_pothos"], c)
                lf.location = p
                lf.rotation_euler = (math.radians(rnd.uniform(-60, 30)), 0, rnd.uniform(0, 6.28))
    return leaves


def cloth_heap(name, loc, size, mat, coll, seed=0):
    """A dropped hoodie / pile of clothes: squashed, displaced sphere with folds."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    for col in o.users_collection:
        col.objects.unlink(o)
    coll.objects.link(o)
    o.scale = size
    tex = bpy.data.textures.new(f"{name}_folds", "CLOUDS")
    tex.noise_scale = 0.35
    d = o.modifiers.new("Folds", "DISPLACE")
    d.texture = tex
    d.strength = 0.35
    d.texture_coords = "LOCAL"
    o.data.materials.append(mat)
    geo.subsurf(o, 1)
    return geo.smooth(o, 80)


def catenary(p0, p1, sag, n):
    pts = []
    for i in range(n + 1):
        t = i / n
        p = p0.lerp(p1, t)
        p.z -= sag * 4 * t * (1 - t)
        pts.append(p)
    return pts


# ---------------------------------------------------------------------------------------
def build_monitor(m, c):
    """Second screen: 27-inch on a stand, angled in toward Ivan from the right."""
    mx, my, rot = 7.36, 3.32, -28
    a = math.radians(rot)
    geo.box("Monitor_Foot", (0.26, 0.20, 0.012), (mx, my + 0.02, TOP), m["monitor"], c, rot=(0, 0, rot), bev=0.004)
    geo.box("Monitor_Neck", (0.05, 0.03, 0.30), (mx - math.sin(a) * 0.05, my + math.cos(a) * 0.05, TOP + 0.01),
            m["monitor"], c, rot=(0, 0, rot), bev=0.006)
    body = geo.box("Monitor_Body", (0.62, 0.035, 0.37), (mx, my, TOP + 0.13), m["monitor"], c, rot=(-4, 0, rot), bev=0.006)
    scr = geo.plane("Monitor_Screen", (0.596, 0.336), (0, -0.0182, 0.185), m["monitor_screen"], c, rot=(90, 0, 0))
    scr.parent = body
    for i, (dx, dz, mat, tilt) in enumerate(((-0.25, 0.30, "sticky_y", 4), (-0.18, 0.31, "sticky_p", -6), (0.24, 0.02, "sticky_b", 3))):
        s = geo.plane(f"Monitor_Sticky_{i}", (0.07, 0.07), (dx, -0.0185, dz), m[mat], c, rot=(90, tilt, 0))
        s.parent = body


def build_desk_clutter(m, c):
    # Felt desk mat under the laptop/mouse zone.
    geo.rounded_slab("Desk_Mat", (0.80, 0.36, 0.003), 0.02, (6.98, 3.02, TOP), m["felt"], c)
    # Printouts: a slumped stack + one loose sheet with code.
    for i in range(9):
        geo.box(f"Paper_Stack_{i}", (0.21, 0.297, 0.0012), (6.40 + rnd.uniform(-0.01, 0.01), 3.38 + rnd.uniform(-0.01, 0.01),
                TOP + 0.0004 + i * 0.0013), m["paper"], c, rot=(0, 0, rnd.uniform(-8, 8)), bev=0)
    geo.plane("Printout_Loose", (0.21, 0.297), (6.66, 3.24, TOP + 0.0015), m["paper_print"], c, rot=(0, 0, -14))
    # Cans, wrapper, duck, headphones, pens.
    geo.cyl("Desk_Can_0", 0.033, 0.168, (6.30, 3.16, TOP), m["can_red"], c, seg=32)
    geo.cyl("Desk_Can_1", 0.033, 0.168, (7.35, 2.62, 0.033), m["can_green"], c, rot=(90, 0, 70), seg=32)
    cloth_heap("Snack_Wrapper", (6.72, 3.32, TOP + 0.01), (0.07, 0.04, 0.012), m["wrapper"], c)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.028, location=(7.60, 2.92, TOP + 0.024))
    duck = bpy.context.active_object
    duck.name = "Rubber_Duck"
    for col in duck.users_collection:
        col.objects.unlink(duck)
    c.objects.link(duck)
    duck.scale = (1.0, 1.25, 0.85)
    duck.data.materials.append(m["duck"])
    geo.smooth(duck, 80)
    geo.cyl("Rubber_Duck_Head", 0.018, 0.03, (7.60, 2.905, TOP + 0.045), m["duck"], c, seg=24, r_top=0.016)
    geo.box("Rubber_Duck_Beak", (0.016, 0.014, 0.006), (7.60, 2.888, TOP + 0.062), m["duck_beak"], c, bev=0.003)
    # Headphones lying face-down at the back-left.
    hx, hy = 6.68, 3.46
    geo.torus("Headphone_Band", 0.085, 0.009, (hx, hy, TOP + 0.03), m["headphone"], c, rot=(90, 0, 20), arc=200)
    for s in (-1, 1):
        geo.cyl(f"Headphone_Cup_{s}", 0.045, 0.035, (hx + s * 0.08 * math.cos(math.radians(20)), hy + s * 0.08 * math.sin(math.radians(20)), TOP),
                m["cushion"], c, seg=32, bev=0.008)
    # Pen cup (an old mug) with pens.
    geo.lathe("PenCup", [(0, 0), (0.035, 0), (0.037, 0.1), (0.033, 0.1), (0.033, 0.006), (0, 0.006)], (6.98, 3.48, TOP), m["shelf_white"], c, seg=32)
    for i in range(5):
        geo.cyl(f"PenCup_Pen_{i}", 0.004, 0.14, (6.98 + rnd.uniform(-0.015, 0.015), 3.48 + rnd.uniform(-0.015, 0.015), TOP + 0.01),
                m["binder_blue" if i % 2 else "binder"], c, rot=(rnd.uniform(-12, 12), rnd.uniform(-12, 12), 0), seg=10)
    # External drive with a blue activity LED, cable bundle off the back edge.
    geo.rounded_slab("External_Drive", (0.08, 0.12, 0.018), 0.008, (7.15, 3.49, TOP), m["drive"], c, rot=(0, 0, 12))
    geo.box("External_Drive_LED", (0.004, 0.002, 0.003), (7.16, 3.428, TOP + 0.009), m["led_blue"], c, bev=0)
    cable = bpy.data.materials.get("Cable") or m["wire"]
    for i in range(4):
        geo.tube(f"Cable_Run_{i}", [(6.9 + i * 0.1, 3.5, TOP + 0.005), (6.85 + i * 0.12, 3.6, TOP - 0.05),
                                     (6.8 + i * 0.1, 3.58, 0.25), (6.9 + i * 0.05, 3.3, 0.01), (6.95, 2.3, 0.01)], 0.0025,
                 cable if i % 2 else m["wire"], c)


def build_shelf(m, c):
    """Open shelving behind Ivan's right shoulder: reads in the face shots, packed with a life."""
    x0, x1, y0, depth = 7.72, 8.62, 2.165, 0.33
    cx = (x0 + x1) / 2
    heights = [0.0, 0.42, 0.80, 1.18, 1.56]
    for s in (x0, x1):
        geo.box(f"Shelf_Side_{s}", (0.022, depth, 1.58), (s, y0 + depth / 2, 0.0), m["shelf_white"], c, bev=0.002)
    for i, h in enumerate(heights):
        geo.box(f"Shelf_Board_{i}", (x1 - x0, depth, 0.022), (cx, y0 + depth / 2, h), m["shelf_white"], c, bev=0.002)
    # contents per shelf (bottom to top)
    spines = bpy.data.materials.get("Book Spines")
    paper = bpy.data.materials.get("Book Paper") or m["paper"]
    # 0: cardboard boxes + binders
    geo.box("Shelf_Box_0", (0.38, 0.30, 0.30), (x0 + 0.23, y0 + 0.16, 0.022), m["cardboard"], c, rot=(0, 0, 3), bev=0.004)
    for i in range(4):
        geo.box(f"Shelf_Binder_{i}", (0.05, 0.28, 0.32), (x1 - 0.06 - i * 0.055, y0 + 0.155, 0.022),
                m["binder" if i % 2 else "binder_blue"], c, rot=(0, -4 if i == 3 else 0, 0), bev=0.003)
    # 1: books row + speaker
    x = x0 + 0.03
    for i in range(12):
        th, hh = rnd.uniform(0.02, 0.045), rnd.uniform(0.2, 0.28)
        geo.box(f"Shelf_Book_{i}", (th, 0.18, hh), (x + th / 2, y0 + 0.11, 0.442), paper if i % 3 else m["binder_blue"], c, bev=0.0015, seg=2)
        x += th + 0.002
    geo.box("Shelf_Speaker", (0.15, 0.17, 0.25), (x1 - 0.12, y0 + 0.11, 0.442), m["speaker"], c, bev=0.006)
    geo.cyl("Shelf_Speaker_Cone", 0.05, 0.004, (x1 - 0.12, y0 + 0.195, 0.442 + 0.09), m["speaker_cone"], c, rot=(-90, 0, 0), seg=32)
    # 2: plant (pothos trailing), framed photo, stacked boxes
    plant("Shelf_Pothos", (x0 + 0.15, y0 + 0.16, 0.822), m, c, kind="pothos")
    geo.box("Shelf_Box_Small", (0.22, 0.2, 0.12), (x1 - 0.2, y0 + 0.12, 0.822), m["cardboard"], c, bev=0.003)
    geo.box("Shelf_Box_Small2", (0.18, 0.18, 0.09), (x1 - 0.21, y0 + 0.12, 0.942), m["cardboard"], c, rot=(0, 0, 8), bev=0.003)
    # 3: board games / tech boxes, a mini fan
    geo.box("Shelf_Console", (0.3, 0.2, 0.06), (cx, y0 + 0.13, 1.202), m["speaker"], c, bev=0.006)
    geo.box("Shelf_Console_LED", (0.01, 0.002, 0.004), (cx + 0.1, y0 + 0.031, 1.23), m["led_blue"], c, bev=0)
    # 4 (top): stacked books flat, a second speaker
    for i in range(4):
        geo.box(f"Shelf_TopBook_{i}", (0.24, 0.17, 0.035), (x0 + 0.18, y0 + 0.12, 1.582 + i * 0.035), paper, c,
                rot=(0, 0, rnd.uniform(-6, 6)), bev=0.0015)
    geo.box("Shelf_Speaker_2", (0.15, 0.17, 0.25), (x1 - 0.12, y0 + 0.11, 1.582), m["speaker"], c, bev=0.006)


def build_fairy_lights(m, c):
    """Warm string lights along the wall behind him: soft bokeh balls in every reverse shot."""
    y = 2.165 + 0.01
    anchors = [Vector((5.95, y, 2.25)), Vector((6.9, y, 2.32)), Vector((7.7, y, 2.25)), Vector((8.7, y, 2.3))]
    bulbs = []
    for a, b in zip(anchors, anchors[1:]):
        pts = catenary(a, b, 0.22, 16)
        geo.tube(f"Fairy_Wire_{a.x:.1f}", [tuple(p) for p in pts[::2]] + [tuple(pts[-1])], 0.0012, m["wire"], c)
        for p in pts[1:-1:2]:
            bulbs.append(p)
    for i, p in enumerate(bulbs):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.007, location=(p.x, p.y + 0.008, p.z - 0.01))
        o = bpy.context.active_object
        o.name = f"Fairy_Bulb_{i}"
        for col in o.users_collection:
            col.objects.unlink(o)
        c.objects.link(o)
        o.data.materials.append(m["bulb"])
    geo.join([o for o in c.objects if o.name.startswith("Fairy_Bulb_")], "Fairy_Bulbs")


def build_corkboard(m, c):
    """Cork board on the east wall by the desk: printed diagrams, receipts, a photo strip."""
    x = 9.75 - 0.012
    geo.box("Corkboard", (0.02, 0.9, 0.6), (x - 0.01, 2.85, 1.15), m["cork"], c, bev=0.004)
    cols = ["sticky_y", "sticky_p", "sticky_b", "paper"]
    for i in range(9):
        y = 2.5 + (i % 4) * 0.2 + rnd.uniform(-0.03, 0.03)
        z = 1.25 + (i // 4) * 0.17 + rnd.uniform(-0.03, 0.03)
        size = (0.09, 0.09) if i % 3 else (0.15, 0.2)
        geo.plane(f"Cork_Note_{i}", size, (x - 0.021, y, z + 0.1), m[cols[i % 4]] if i % 3 else m["paper_print"], c,
                  rot=(90, rnd.uniform(-8, 8), -90))
        geo.cyl(f"Cork_Pin_{i}", 0.004, 0.008, (x - 0.028, y, z + 0.1 + size[1] * 0.4), m["pin"], c, rot=(0, -90, 0), seg=10)


def build_floor_life(m, c):
    """Boxes from deliveries he hasn't unpacked, a dropped hoodie, a backpack, a fan, plants by the light."""
    # Delivery boxes left of the desk, one opened.
    geo.box("Floor_Box_A", (0.48, 0.36, 0.32), (5.95, 3.25, 0.0), m["cardboard"], c, rot=(0, 0, 8), bev=0.004)
    geo.box("Floor_Box_A_Tape", (0.06, 0.362, 0.002), (5.95, 3.25, 0.321), m["tape"], c, rot=(0, 0, 8), bev=0)
    geo.box("Floor_Box_B", (0.36, 0.30, 0.22), (5.97, 3.27, 0.322), m["cardboard"], c, rot=(0, 0, -6), bev=0.004)
    geo.box("Floor_Box_C", (0.40, 0.30, 0.25), (6.05, 3.80, 0.0), m["cardboard"], c, rot=(0, 0, 22), bev=0.004)
    for s in (-1, 1):
        geo.box(f"Floor_Box_C_Flap_{s}", (0.40, 0.15, 0.004), (6.05 + s * 0.06, 3.80 + s * 0.2, 0.25), m["cardboard"], c,
                rot=(s * 70, 0, 22), bev=0)
    cloth_heap("Hoodie_Floor", (6.42, 2.32, 0.05), (0.28, 0.22, 0.07), m["hoodie"], c)
    cloth_heap("Backpack", (7.95, 2.85, 0.18), (0.16, 0.12, 0.2), m["bag"], c)
    cloth_heap("Sock_0", (7.1, 2.05 + 0.4, 0.012), (0.09, 0.03, 0.012), m["sock"], c)
    geo.lathe("Water_Bottle", [(0, 0), (0.035, 0), (0.036, 0.18), (0.015, 0.22), (0.012, 0.24), (0, 0.24)], (6.40, 3.02, 0.035),
              m["bottle"], c, rot=(90, 0, 35), seg=32)
    # Trash bag by the kitchen island: two days of takeout.
    cloth_heap("Trash_Bag", (7.55, 5.0, 0.22), (0.22, 0.2, 0.26), m["trash_bag"], c)
    # Floor fan near the desk (birdcage ref).
    fx, fy = 8.15, 3.75
    geo.cyl("Fan_Base", 0.14, 0.03, (fx, fy, 0), m["fan_white"], c, seg=40, bev=0.006)
    geo.cyl("Fan_Pole", 0.015, 0.75, (fx, fy, 0.03), m["fan_white"], c, seg=16)
    geo.cyl("Fan_Motor", 0.07, 0.12, (fx, fy - 0.02, 0.78), m["fan_white"], c, rot=(90, 0, 210), seg=32)
    geo.torus("Fan_Grille", 0.17, 0.004, (fx - 0.04, fy - 0.08, 0.85), m["fan_white"], c, rot=(90, 0, 210), ring=8)
    # Plants: big monstera by the east window, snake plant by the balcony door.
    plant("Monstera", (9.25, 5.0, 0.0), m, c, kind="monstera", scale=1.25)
    plant("SnakePlant", (5.95, 5.05, 0.0), m, c, kind="snake", scale=1.0, pot="pot_terra")
    plant("Monstera_Small", (7.70, 3.38, 0.0), m, c, kind="monstera", scale=0.55, pot="pot_terra")


def build(preset="3am"):
    c = geo.coll("Clutter")
    m = _mats()
    build_monitor(m, c)
    build_desk_clutter(m, c)
    build_shelf(m, c)
    build_fairy_lights(m, c)
    build_corkboard(m, c)
    build_floor_life(m, c)
    return c
