"""Story dressing outside the desk zone (tiers T2/T3). Each item cites why it exists.

[S] stated in the script · [I] inferred · [F] planted for a later chapter (see docs/WORLD_BIBLE.md).
"""
import math
import random
from pathlib import Path

import bpy
import bmesh

import geo
import materials as M

TEX = Path(__file__).resolve().parents[1] / "assets" / "textures"
BOOKS_N = 10   # rows in book_spines.png (tools/make_textures.py BOOKS)


def plane_uv(name, size, loc, mat, coll, rot, uv_rect):
    """Plane whose UVs map to a sub-rectangle (u0, v0, u1, v1) of an atlas."""
    o = geo.plane(name, size, loc, mat, coll, rot)
    u0, v0, u1, v1 = uv_rect
    uv = o.data.uv_layers.active.data
    for li, loop in enumerate(o.data.loops):
        u, v = uv[li].uv
        uv[li].uv = (u0 + (u1 - u0) * u, v0 + (v1 - v0) * v)
    return o


def _mats():
    return {
        "spines": M.image_mat("Book Spines", TEX / "book_spines.png", 0.55),
        "paper": M.paint("Book Paper", (0.78, 0.75, 0.66), 0.9),
        "deepwork": M.image_mat("Deep Work Cover", TEX / "book_deep_work.png", 0.5),
        "ribbon": M.paint("Bookmark Ribbon", (0.45, 0.04, 0.04), 0.6),
        "photo": M.image_mat("Photo Couple", TEX / "photo_couple.png", 0.25),
        "print": M.image_mat("Wall Print", TEX / "wall_print.png", 0.7),
        "frame_black": M.paint("Frame Black", (0.015, 0.015, 0.017), 0.35),
        "frame_oak": M.walnut("Frame Oak", (0.30, 0.20, 0.11), (0.48, 0.34, 0.2)),
        "radio_red": M.paint("Radio Red", (0.36, 0.05, 0.04), 0.35, coat=0.3),
        "radio_cream": M.paint("Radio Cream", (0.66, 0.6, 0.48), 0.4),
        "grille": M.fabric("Radio Grille", (0.03, 0.03, 0.03), 0.9, weave=1400.0),
        "chrome": M.brushed_metal("Chrome", (0.9, 0.9, 0.92), 0.08, 0.0),
        "rug": _rug(),
        "envelope": M.paint("Envelope", (0.72, 0.70, 0.64), 0.85),
        "envelope_k": M.paint("Envelope Kraft", (0.48, 0.35, 0.2), 0.85),
        "bag": M.fabric("Laptop Bag", (0.03, 0.035, 0.04), 0.85, weave=1100.0),
        "pot": M.ceramic("Plant Pot", (0.55, 0.36, 0.26), 0.7),
        "soil": M.paint("Soil", (0.05, 0.035, 0.02), 0.95),
        "leaf": M.paint("Leaf Green", (0.05, 0.12, 0.04), 0.5),
        "leaf_dry": M.paint("Leaf Dry", (0.32, 0.25, 0.10), 0.7),
        "carafe": M.glass("Carafe Glass", (0.9, 0.93, 0.92)),
        "coffee": bpy.data.materials.get("Coffee") or M.liquid_coffee(),
        "black": M.plastic("Appliance Black", (0.012, 0.012, 0.013), 0.3),
        "led_clock": M.emission("Coffee Maker Clock", (0.3, 1.0, 0.55), 6.0),
        "can_a": M.brushed_metal("Can Silver Blue", (0.25, 0.42, 0.85), 0.25, 0.3),
        "can_b": M.brushed_metal("Can Black", (0.06, 0.06, 0.07), 0.25, 0.3),
        "bin": M.plastic("Bin Grey", (0.12, 0.12, 0.13), 0.5),
        "paper_ball": M.paint("Crumpled Paper", (0.82, 0.8, 0.75), 0.9),
        "curtain": _sheer(),
        "shoe": M.plastic("Shoe Leather", (0.12, 0.06, 0.03), 0.45),
        "sneaker": M.fabric("Sneaker", (0.6, 0.6, 0.6), 0.8, weave=700.0),
        "sole": M.plastic("Sole White", (0.8, 0.8, 0.78), 0.6),
        "plate": M.ceramic("Plate", (0.82, 0.81, 0.78)),
        "towel": M.fabric("Dish Towel", (0.32, 0.38, 0.45), 0.9, weave=500.0),
        "key": M.brushed_metal("Key Brass", (0.75, 0.6, 0.3), 0.3, 0.2),
        "magnet": M.plastic("Magnet", (0.8, 0.2, 0.1), 0.4),
        "menu": M.paint("Takeout Menu", (0.85, 0.82, 0.7), 0.85),
    }


def _rug():
    mat = M._new("Rug Wool")
    k = M.NodeKit(mat)
    p, po = k.pos(scale=(1.0, 1.0, 1.0))
    w = k.node("ShaderNodeTexWave", Scale=6.0, Distortion=0.6, _wave_type="BANDS", _bands_direction="X")
    k.link(p, po, w, "Vector")
    col = k.ramp(w, "Fac", [(0.0, (0.05, 0.05, 0.055)), (0.45, (0.08, 0.075, 0.07)), (0.55, (0.20, 0.17, 0.13)),
                            (0.6, (0.08, 0.075, 0.07)), (1.0, (0.05, 0.05, 0.055))])
    k.link(col, "Color", k.bsdf, "Base Color")
    n = k.node("ShaderNodeTexNoise", Scale=1200.0, Detail=2.0)
    k.link(p, po, n, "Vector")
    k.bump(n, "Fac", strength=0.35, distance=0.002)
    k.set(Roughness=1.0, **{"Sheen Weight": 0.6})
    return mat


def _sheer():
    mat = M._new("Sheer Curtain")
    k = M.NodeKit(mat)
    k.set(**{"Base Color": (0.75, 0.73, 0.68, 1), "Roughness": 0.8, "Transmission Weight": 0.0,
             "Subsurface Weight": 0.0, "Alpha": 0.55})
    tr = k.node("ShaderNodeBsdfTranslucent", Color=(0.8, 0.76, 0.68, 1))
    mix = k.node("ShaderNodeMixShader", Fac=0.45)
    k.nt.links.remove(k.nt.links[0])
    k.link(k.bsdf, "BSDF", mix, 1)
    k.link(tr, "BSDF", mix, 2)
    k.link(mix, "Shader", k.out, "Surface")
    return mat


def _wavy_cloth(name, w, h, loc, mat, coll, rot=(0, 0, 0), folds=9, depth=0.05):
    """Hanging fabric: subdivided plane with sine folds, slightly flared at the bottom."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=60, y_segments=20, size=0.5)
    for v in bm.verts:
        u, t = v.co.x + 0.5, v.co.y + 0.5     # u across, t up
        x = (u - 0.5) * w
        z = t * h
        flare = 1.0 + 0.6 * (1 - t)
        y = math.sin(u * folds * 2 * math.pi) * depth * flare
        v.co = (x, y, z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(mat)
    o.location = loc
    o.rotation_euler = tuple(math.radians(r) for r in rot)
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = 0.002
    return geo.smooth(o, 80)


# ---------------------------------------------------------------------------------------
def build_bookshelf(m, c):
    """Drawer with books [S floor plan]: Superintelligence [F], Deep Work on the bean bag [F]."""
    x0, yc, top = 3.72, 3.9, 0.9                  # drawer: 0.4 deep along X, 0.8 long along Y, faces +X
    rnd = random.Random(5)
    y = yc - 0.36
    order = [0, 2, 4, 3, 6, 7, 8, 9, 5]           # rows in the atlas (index 1 is Deep Work: it's on the bean bag)
    for i, row in enumerate(order):
        th = rnd.uniform(0.025, 0.045)
        hgt = rnd.uniform(0.20, 0.25)
        dep = rnd.uniform(0.14, 0.17)
        y += th / 2
        geo.box(f"Book_{i}", (dep, th, hgt), (x0 + 0.03, y, top), m["paper"], c, bev=0.0015, seg=2)
        v0 = 1 - (row + 1) / BOOKS_N
        v1 = 1 - row / BOOKS_N
        plane_uv(f"Book_Spine_{i}", (hgt, th * 0.98), (x0 + 0.03 + dep / 2 + 0.0008, y, top + hgt / 2),
                 m["spines"], c, (0, 90, 0), (0.0, v0, 1.0, v1))
        y += th / 2 + 0.002
    # Bookend stack lying flat + radio + framed photo.
    for j in range(3):
        geo.box(f"Book_Flat_{j}", (0.16, 0.23, 0.03), (x0 + 0.02, yc + 0.22, top + j * 0.03), m["paper"], c,
                rot=(0, 0, rnd.uniform(-6, 6)), bev=0.0015, seg=2)
    build_radio(m, c, (x0 + 0.02, yc + 0.22, top + 0.09))
    build_photo(m, c, (x0 + 0.05, yc - 0.02 + 0.03, top), rot_z=-60)


def build_radio(m, c, base):
    """Battery radio [F]: 'according to his battery-powered radio' (The End)."""
    x, y, z = base
    geo.rounded_slab("Radio_Body", (0.12, 0.24, 0.14), 0.02, (x, y, z), m["radio_red"], c, rot=(0, 0, 90))
    geo.plane("Radio_Grille", (0.15, 0.09), (x + 0.0605, y - 0.03, z + 0.07), m["grille"], c, rot=(0, 90, 0))
    geo.box("Radio_Dial", (0.003, 0.06, 0.03), (x + 0.06, y + 0.07, z + 0.07), m["radio_cream"], c, bev=0.001)
    geo.cyl("Radio_Knob", 0.012, 0.012, (x + 0.06, y + 0.07, z + 0.035), m["chrome"], c, rot=(0, 90, 0), seg=24)
    geo.tube("Radio_Antenna", [(x - 0.03, y - 0.1, z + 0.14), (x - 0.06, y - 0.16, z + 0.40)], 0.0018, m["chrome"], c,
             handles="VECTOR")
    geo.box("Radio_Handle", (0.02, 0.16, 0.012), (x, y, z + 0.14), m["radio_cream"], c, bev=0.004)


def build_photo(m, c, base, rot_z=0):
    """Framed photo of Ivan and her [I][F]: turned toward the desk, unlooked at."""
    x, y, z = base
    f = geo.box("Photo_Frame", (0.20, 0.018, 0.15), (x, y, z), m["frame_oak"], c, rot=(-10, 0, rot_z), bev=0.002)
    p = geo.plane("Photo_Print", (0.17, 0.12), (0, -0.0095, 0.075), m["photo"], c, rot=(90, 0, 0))
    p.parent = f


def build_bean_bag_book(m, c):
    """Deep Work, bookmark stuck near the start [F]: he 'tries to read a book but can't focus'."""
    bx, by, bz = 4.40, 4.38, 0.58
    b = geo.box("DeepWork_Book", (0.14, 0.21, 0.03), (bx, by, bz), m["paper"], c, rot=(6, -4, 28), bev=0.0015)
    cov = geo.plane("DeepWork_Cover", (0.14, 0.21), (0, 0, 0.0302), m["deepwork"], c)
    cov.parent = b
    rib = geo.box("DeepWork_Ribbon", (0.004, 0.08, 0.0008), (0.05, -0.12, 0.012), m["ribbon"], c, bev=0)
    rib.parent = b


def build_rug(m, c):
    geo.box("Rug", (2.1, 1.5, 0.008), (4.75, 3.95, 0.0), m["rug"], c, bev=0.003)


def build_wall_print(m, c):
    x = 3.52 + 0.012
    f = geo.box("Print_Frame", (0.025, 0.52, 0.72), (x, 3.9, 1.32), m["frame_black"], c, bev=0.002)
    geo.plane("Print_Art", (0.46, 0.66), (x + 0.0135, 3.9, 1.68), m["print"], c, rot=(90, 0, 90))


def build_dining(m, c):
    """Dining table, unused [I]: a dumped laptop bag, unopened mail, keys, a dying plant."""
    tx, ty, top = 8.6, 4.35, 0.75
    rnd = random.Random(9)
    for i in range(7):
        mat = m["envelope_k"] if i % 3 == 0 else m["envelope"]
        geo.box(f"Mail_{i}", (0.23, 0.11, 0.002), (tx - 0.18 + rnd.uniform(-0.02, 0.02), ty - 0.12 + rnd.uniform(-0.02, 0.02),
                                                    top + i * 0.0022), mat, c, rot=(0, 0, rnd.uniform(-20, 20)), bev=0)
    geo.rounded_slab("Laptop_Bag", (0.40, 0.10, 0.30), 0.04, (7.97, 4.33, 0.47), m["bag"], c, rot=(0, 0, 90))
    for i in range(2):
        geo.box(f"Key_{i}", (0.05, 0.018, 0.002), (tx + 0.12 + i * 0.012, ty - 0.2 + i * 0.01, top), m["key"], c,
                rot=(0, 0, 30 + i * 25), bev=0.0005)
    # Plant: a few healthy blades, the outer ones bent and browning.
    px, py = tx + 0.15, ty + 0.12
    geo.lathe("Plant_Pot", [(0, 0), (0.055, 0), (0.07, 0.12), (0.064, 0.12), (0.05, 0.01), (0, 0.01)], (px, py, top),
              m["pot"], c, seg=32)
    geo.cyl("Plant_Soil", 0.064, 0.004, (px, py, top + 0.105), m["soil"], c, seg=32)
    for i in range(11):
        a = i / 11 * 2 * math.pi + rnd.uniform(-0.2, 0.2)
        droop = i % 3 == 0
        tip = (px + math.cos(a) * (0.16 if droop else 0.05), py + math.sin(a) * (0.16 if droop else 0.05),
               top + (0.16 if droop else 0.32 + rnd.uniform(0, 0.08)))
        mid = (px + math.cos(a) * 0.03, py + math.sin(a) * 0.03, top + 0.22)
        geo.tube(f"Leaf_{i}", [(px, py, top + 0.1), mid, tip], 0.004, m["leaf_dry"] if droop else m["leaf"], c)


def build_kitchen(m, c):
    """Coffee maker with an inch left in the pot [I]; sink with mugs [I]; fridge door clutter."""
    cx, cy, top = 8.72, 7.22, 0.9
    geo.box("CoffeeMaker_Body", (0.20, 0.24, 0.34), (cx, cy + 0.02, top), m["black"], c, bev=0.01)
    geo.box("CoffeeMaker_Plate", (0.18, 0.2, 0.02), (cx, cy - 0.08, top), m["black"], c, bev=0.004)
    geo.lathe("Carafe", [(0, 0), (0.06, 0), (0.07, 0.04), (0.055, 0.13), (0.052, 0.13), (0.067, 0.04), (0.057, 0.003), (0, 0.003)],
              (cx, cy - 0.1, top + 0.02), m["carafe"], c, seg=40)
    geo.lathe("Carafe_Coffee", [(0, 0.004), (0.058, 0.004), (0.064, 0.025), (0, 0.025)], (cx, cy - 0.1, top + 0.02),
              m["coffee"], c, seg=40)
    geo.plane("CoffeeMaker_Clock", (0.05, 0.016), (cx, cy - 0.101, top + 0.26), m["led_clock"], c, rot=(90, 0, 0))
    # Sink: two mugs and a plate waiting.
    sx, sy = 7.35, 7.12
    geo.cyl("Sink_Plate", 0.12, 0.012, (sx - 0.05, sy, 0.73), m["plate"], c, rot=(18, 0, 0), seg=40)
    for i, (dx, dy) in enumerate(((0.12, 0.05), (0.05, -0.08))):
        geo.lathe(f"Sink_Mug_{i}", [(0, 0), (0.038, 0), (0.041, 0.095), (0.037, 0.095), (0.037, 0.008), (0, 0.008)],
                  (sx + dx, sy + dy, 0.70), m["plate"], c, seg=32, rot=(0, 70 if i else 0, 30))
    geo.box("Dish_Towel", (0.02, 0.22, 0.30), (7.86, 6.83, 0.58), m["towel"], c, bev=0.006)
    # Fridge door: magnets and a takeout menu.
    fx = 9.4
    geo.box("Fridge_Menu", (0.21, 0.002, 0.28), (fx - 0.05, 6.79, 1.25), m["menu"], c, rot=(0, 0, 0), bev=0)
    for i, (dx, dz) in enumerate(((-0.12, 1.5), (0.02, 1.52), (0.15, 1.1))):
        geo.cyl(f"Magnet_{i}", 0.015, 0.008, (fx + dx, 6.79, dz), m["magnet"], c, rot=(90, 0, 0), seg=16)


def build_bin(m, c):
    """Bin by the desk: crumpled drafts and energy-drink cans [I] ('too much coffee', two days in)."""
    bx, by = 6.05, 2.75
    geo.lathe("Bin", [(0, 0), (0.12, 0), (0.14, 0.32), (0.135, 0.32), (0.115, 0.005), (0, 0.005)], (bx, by, 0), m["bin"], c, seg=40)
    rnd = random.Random(2)
    for i in range(6):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.035, location=(bx + rnd.uniform(-0.06, 0.06),
                                              by + rnd.uniform(-0.06, 0.06), 0.30 + rnd.uniform(0, 0.06)))
        o = bpy.context.active_object
        o.name = f"PaperBall_{i}"
        for col in o.users_collection:
            col.objects.unlink(o)
        c.objects.link(o)
        d = o.modifiers.new("Crumple", "DISPLACE")
        tex = bpy.data.textures.new(f"crumple_{i}", "VORONOI")
        tex.noise_scale = 0.02
        d.texture = tex
        d.strength = 0.012
        o.data.materials.append(m["paper_ball"])
    for i, (dx, dy, lie) in enumerate(((0.25, 0.05, True), (0.04, -0.03, False), (-0.2, 0.12, True))):
        geo.cyl(f"Can_{i}", 0.033, 0.168, (bx + dx, by + dy, 0.033 if lie else 0.29), m["can_a" if i % 2 else "can_b"], c,
                rot=(90 if lie else 0, 0, 40 * i), seg=32)


def build_curtains(m, c):
    """Sheer curtains on the east window: they shape the sunrise and the city glow."""
    x = 9.75 - 0.10
    for side, y in (("S", 2.55), ("N", 4.65)):
        _wavy_cloth(f"Curtain_{side}", 0.55, 2.35, (x, y, 0.02), m["curtain"], c, rot=(0, 0, 90))
    geo.cyl("Curtain_Rod", 0.012, 2.9, (x, 2.2, 2.42), m["frame_black"], c, rot=(-90, 0, 0), seg=16)


def build_entry(m, c):
    """Shoes kicked off by the door; one pair of sneakers he hasn't worn in days."""
    for i, (x, y, mat, rot) in enumerate(((3.80, 1.05, "shoe", 80), (3.92, 1.12, "shoe", 95),
                                          (4.30, 0.55, "sneaker", 20), (4.45, 0.62, "sneaker", -10))):
        geo.rounded_slab(f"Shoe_{i}", (0.10, 0.28, 0.08), 0.045, (x, y, 0.012), m[mat], c, rot=(0, 0, rot))
        geo.rounded_slab(f"Sole_{i}", (0.105, 0.285, 0.014), 0.045, (x, y, 0.0), m["sole"], c, rot=(0, 0, rot))


def build(preset="3am"):
    c = geo.coll("Story_Dressing")
    m = _mats()
    build_bookshelf(m, c)
    build_bean_bag_book(m, c)
    build_rug(m, c)
    build_wall_print(m, c)
    build_dining(m, c)
    build_kitchen(m, c)
    build_bin(m, c)
    build_curtains(m, c)
    build_entry(m, c)
    return c
