"""Hero desk zone (detail tier T1): the place the intro chapter happens.

Ivan sits at (6.95, 2.58) facing +Y (north) into the flat, back to the bathroom wall.
Everything here is placed in world metres (Blender Z-up), story notes inline.
"""
import math
import random
from pathlib import Path

import bpy

import geo
import materials as M

TEX = Path(__file__).resolve().parents[1] / "assets" / "textures"
DESK = (6.95, 3.2)          # desk centre
TOP = 0.75                  # desk top height
REMOVE = ("Furn_Desk", "Furn_OfficeChair", "Furn_Laptop", "Furn_DeskLamp", "Furn_WallClock")


def _mats():
    return {
        "walnut": M.walnut("Desk Walnut"),
        "steel": M.paint("Black Steel", (0.02, 0.02, 0.022), 0.38, coat=0.1),
        "alu": M.brushed_metal("Laptop Alu", (0.62, 0.63, 0.65), 0.28, 0.5),
        "keys": M.plastic("Keys", (0.012, 0.012, 0.014), 0.45),
        "pad": M.plastic("Trackpad", (0.18, 0.18, 0.19), 0.25),
        "screen": M.emission("Laptop Screen", (1.0, 1.0, 1.0), 2.2, TEX / "laptop_screen.png"),
        "bezel": M.plastic("Bezel", (0.004, 0.004, 0.005), 0.08),
        "glass": M.glass("Tumbler Glass", (0.96, 0.99, 0.98)),
        "water": M.water(),
        "bubble": _bubble(),
        "mug_white": M.ceramic("Mug White", (0.78, 0.76, 0.72)),
        "mug_navy": M.ceramic("Mug Navy", (0.03, 0.05, 0.11)),
        "mug_sage": M.ceramic("Mug Sage", (0.30, 0.36, 0.30)),
        "coffee": M.liquid_coffee(),
        "residue": M.paint("Coffee Residue", (0.06, 0.03, 0.015), 0.6),
        "phone": M.plastic("Phone Body", (0.02, 0.02, 0.025), 0.3),
        "phone_screen": M.emission("Phone Screen", (1, 1, 1), 0.9, TEX / "phone_lock.png"),
        "page": M.image_mat("Notebook Page", TEX / "notebook_page.png", 0.85),
        "card": M.paint("Cardboard Cover", (0.10, 0.12, 0.16), 0.8),
        "pen": M.plastic("Pen Blue", (0.02, 0.05, 0.25), 0.3),
        "kraft": M.paint("Kraft Paper", (0.40, 0.27, 0.14), 0.88),
        "noodle": M.paint("Cold Noodles", (0.55, 0.40, 0.18), 0.5),
        "wood_stick": M.paint("Chopstick", (0.62, 0.50, 0.34), 0.7),
        "fabric": M.fabric("Chair Mesh", (0.02, 0.022, 0.026), 0.9, weave=900.0),
        "rubber": M.plastic("Rubber", (0.01, 0.01, 0.01), 0.7),
        "clock_rim": M.plastic("Clock Rim", (0.02, 0.02, 0.02), 0.35),
        "clock_face": M.image_mat("Clock Face", TEX / "clock_face.png", 0.6),
        "sticky_a": M.image_mat("Sticky Review", TEX / "sticky_review.png", 0.9),
        "sticky_b": M.image_mat("Sticky Ship", TEX / "sticky_ship.png", 0.9),
        "cable": M.plastic("Cable", (0.85, 0.85, 0.83), 0.45),
        "router": M.plastic("Router", (0.85, 0.85, 0.84), 0.35),
        "led": M.emission("LED Green", (0.25, 1.0, 0.45), 25.0),
        "led_amber": M.emission("LED Amber", (1.0, 0.55, 0.1), 15.0),
        "ring": _ring_stain(),
    }


def _bubble():
    """Air pocket inside water: relative IOR < 1 so it reads as a bright-edged bubble."""
    mat = M._new("Air Bubble")
    k = M.NodeKit(mat)
    k.set(**{"Roughness": 0.0, "Transmission Weight": 1.0, "IOR": 0.75})
    return mat


def _ring_stain():
    """Dried coffee ring: a thin dark band, transparent elsewhere (decal on a plane)."""
    mat = M._new("Coffee Ring Stain")
    mat.blend_method = "HASHED" if hasattr(mat, "blend_method") else None
    k = M.NodeKit(mat)
    tc = k.node("ShaderNodeTexCoord")
    sep = k.node("ShaderNodeVectorMath", _operation="SUBTRACT")
    sep.inputs[1].default_value = (0.5, 0.5, 0.0)
    k.link(tc, "UV", sep, 0)
    ln = k.node("ShaderNodeVectorMath", _operation="LENGTH")
    k.link(sep, "Vector", ln, 0)
    noise = k.node("ShaderNodeTexNoise", Scale=9.0, Detail=4.0)
    k.link(tc, "UV", noise, "Vector")
    jitter = k.node("ShaderNodeMath", _operation="MULTIPLY_ADD", Value=0.04)
    jitter.inputs[2].default_value = -0.02
    k.link(noise, "Fac", jitter, 0)
    jitter.inputs[1].default_value = 0.04
    add = k.node("ShaderNodeMath", _operation="ADD")
    k.link(ln, "Value", add, 0)
    k.link(jitter, 0, add, 1)
    band = k.ramp(add, 0, [(0.0, (0, 0, 0)), (0.40, (0.05, 0.05, 0.05)), (0.455, (0.75, 0.75, 0.75)), (0.48, (0, 0, 0))])
    k.link(band, "Color", k.bsdf, "Alpha")
    k.set(**{"Base Color": (0.10, 0.05, 0.02, 1), "Roughness": 0.5})
    return mat


def _hide_shell():
    for n in REMOVE:
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------------------------------
def build_desk(m, c):
    x, y = DESK
    geo.box("Desk_Top", (1.40, 0.70, 0.028), (x, y, TOP - 0.028), m["walnut"], c, bev=0.004)
    # Black steel sled frame: two U-legs + rear stretcher.
    for sx in (-1, 1):
        lx = x + sx * 0.64
        geo.box(f"Desk_Leg_{sx}", (0.03, 0.62, 0.02), (lx, y, 0.0), m["steel"], c, bev=0.002)          # floor rail
        for sy in (-1, 1):
            geo.box(f"Desk_Post_{sx}_{sy}", (0.03, 0.02, TOP - 0.048), (lx, y + sy * 0.30, 0.02), m["steel"], c, bev=0.002)
        geo.box(f"Desk_Arm_{sx}", (0.03, 0.62, 0.02), (lx, y, TOP - 0.048), m["steel"], c, bev=0.002)
    geo.box("Desk_Stretcher", (1.25, 0.02, 0.05), (x, y + 0.28, TOP - 0.098), m["steel"], c, bev=0.002)


def build_laptop(m, c):
    x, y = DESK[0], 3.08
    base_h = 0.0155
    base = geo.rounded_slab("Laptop_Base", (0.312, 0.221, base_h), 0.012, (x, y, TOP), m["alu"], c)
    # Keyboard: 14 x 6 keys in a recessed well toward the hinge.
    for r in range(6):
        for k_ in range(14):
            w = 0.0155 if not (r == 5 and 4 <= k_ <= 8) else 0.0155
            kx = x - 0.1300 + k_ * 0.0187
            ky = y + 0.072 - r * 0.0187
            if r == 5 and k_ in (5, 6, 7):
                if k_ != 6:
                    continue
                w = 0.0155 * 3 + 0.0064
            geo.box(f"Key_{r}_{k_}", (w, 0.0155, 0.0012), (kx, ky, TOP + base_h), m["keys"], c, bev=0.0008, seg=2)
    geo.rounded_slab("Laptop_Trackpad", (0.12, 0.076, 0.0004), 0.006, (x, y - 0.062, TOP + base_h), m["pad"], c)
    keys = [o for o in c.objects if o.name.startswith("Key_")]
    geo.join(keys, "Laptop_Keys")
    # Lid on a hinge empty, opened ~110 degrees (20 degrees past vertical, away from Ivan).
    hinge = bpy.data.objects.new("Laptop_Hinge", None)
    c.objects.link(hinge)
    hinge.location = (x, y + 0.1105, TOP + base_h)
    hinge.rotation_euler = (math.radians(-20), 0, 0)
    lid = geo.rounded_slab("Laptop_Lid", (0.312, 0.0055, 0.215), 0.012, (0, 0.00275, 0), m["alu"], c, rot=(0, 0, 0))
    lid.parent = hinge
    bez = geo.plane("Laptop_Bezel", (0.304, 0.207), (0, -0.0004, 0.1085), m["bezel"], c, rot=(90, 0, 0))
    bez.parent = hinge
    scr = geo.plane("Laptop_Screen", (0.288, 0.180), (0, -0.0007, 0.112), m["screen"], c, rot=(90, 0, 0))
    scr.parent = hinge
    note = geo.plane("Sticky_OnLid", (0.06, 0.06), (0.07, 0.0058, 0.13), m["sticky_a"], c, rot=(90, 0, 180 + 6))
    note.parent = hinge
    return hinge


def build_glass(m, c):
    """The untouched glass of water, poured six hours ago: full, with clinging bubbles."""
    gx, gy = 7.25, 3.15
    prof = [(0.0, 0.0), (0.0335, 0.0), (0.0355, 0.002), (0.0360, 0.006), (0.0395, 0.108), (0.0400, 0.110),
            (0.0385, 0.110), (0.0372, 0.098), (0.0338, 0.009), (0.0, 0.009)]
    geo.lathe("Water_Glass", prof, (gx, gy, TOP), m["glass"], c)
    wprof = [(0.0, 0.0092), (0.0336, 0.0092), (0.0369, 0.0955), (0.0, 0.0955)]
    geo.lathe("Water", wprof, (gx, gy, TOP), m["water"], c)
    rnd = random.Random(3)
    for i in range(46):
        a = rnd.uniform(0, 2 * math.pi)
        z = rnd.uniform(0.012, 0.092)
        r_wall = 0.0336 + (0.0369 - 0.0336) * (z - 0.0092) / (0.0955 - 0.0092) - 0.0011
        rad = rnd.uniform(0.0004, 0.0012)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=rad,
                                             location=(gx + r_wall * math.cos(a), gy + r_wall * math.sin(a), TOP + z))
        b = bpy.context.active_object
        b.name = f"Bubble_{i}"
        for col in b.users_collection:
            col.objects.unlink(b)
        c.objects.link(b)
        b.data.materials.append(m["bubble"])
    geo.join([o for o in c.objects if o.name.startswith("Bubble_")], "Water_Bubbles")


def _mug(name, loc, mat, m, c, level=None, residue_at=None, turn=0.0):
    prof = [(0.0, 0.0), (0.038, 0.0), (0.041, 0.004), (0.041, 0.095), (0.0395, 0.097), (0.037, 0.095),
            (0.037, 0.008), (0.0, 0.008)]
    body = geo.lathe(name, prof, loc, mat, c)
    h = geo.torus(name + "_Handle", 0.024, 0.006, (loc[0] + 0.041 * math.cos(math.radians(turn)),
                                                  loc[1] + 0.041 * math.sin(math.radians(turn)), loc[2] + 0.05),
                  mat, c, rot=(90, 0, turn + 90), arc=200)
    h.rotation_euler = (math.radians(90), 0, math.radians(turn - 90))
    if level:
        geo.cyl(name + "_Coffee", 0.0369, 0.002, (loc[0], loc[1], loc[2] + level - 0.002), m["coffee"], c, seg=48)
    if residue_at:
        geo.torus(name + "_Residue", 0.0368, 0.0007, (loc[0], loc[1], loc[2] + residue_at), m["residue"], c, ring=8)
        geo.cyl(name + "_Dregs", 0.0365, 0.0012, (loc[0], loc[1], loc[2] + 0.0082), m["coffee"], c, seg=48)
    return body


def build_mugs(m, c):
    """Count the mugs, count the hours: one cold half-full, two drained."""
    _mug("Mug_Cold", (6.30, 2.97, TOP), m["mug_white"], m, c, level=0.058, turn=200)
    _mug("Mug_Empty_A", (6.85, 3.45, TOP), m["mug_navy"], m, c, residue_at=0.07, turn=150)
    _mug("Mug_Empty_B", (7.58, 3.22, TOP), m["mug_sage"], m, c, residue_at=0.052, turn=30)
    for i, (x, y, s) in enumerate(((6.82, 3.40, 0.092), (7.18, 3.43, 0.088), (6.70, 3.18, 0.09))):
        geo.plane(f"Ring_Stain_{i}", (s, s), (x, y, TOP + 0.0003), m["ring"], c, rot=(0, 0, 37 * i))


def build_phone(m, c):
    px, py = 7.40, 2.93
    geo.rounded_slab("Phone", (0.0715, 0.147, 0.0078), 0.009, (px, py, TOP), m["phone"], c, rot=(0, 0, -14))
    geo.plane("Phone_Screen", (0.066, 0.142), (px, py, TOP + 0.0081), m["phone_screen"], c, rot=(0, 0, -14))


def build_notebook(m, c):
    nx, ny = 6.52, 2.97
    geo.box("Notebook_Cover", (0.30, 0.215, 0.006), (nx, ny, TOP), m["card"], c, rot=(0, 0, 8), bev=0.001)
    geo.plane("Notebook_Page", (0.29, 0.207), (nx, ny, TOP + 0.0062), m["page"], c, rot=(0, 0, 8))
    for i in range(14):   # spiral binding down the middle
        a = math.radians(8)
        off = -0.095 + i * 0.0145
        geo.torus(f"Spiral_{i}", 0.006, 0.0007, (nx - math.sin(a) * off, ny + math.cos(a) * off, TOP + 0.006),
                  m["steel"], c, rot=(0, 90, 8), ring=6, seg=16)
    geo.join([o for o in c.objects if o.name.startswith("Spiral_")], "Notebook_Spiral")
    geo.cyl("Pen", 0.0045, 0.14, (6.58, 2.92, TOP + 0.011), m["pen"], c, rot=(0, 90, 32), seg=16)


def build_mouse_and_cable(m, c):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=(7.22, 2.98, TOP))
    mouse = bpy.context.active_object
    mouse.name = "Mouse"
    for col in mouse.users_collection:
        col.objects.unlink(mouse)
    c.objects.link(mouse)
    mouse.scale = (0.031, 0.056, 0.019)
    mouse.data.materials.append(m["phone"])
    geo.smooth(mouse, 80)
    # Laptop charger: out of the left side, off the desk edge, across the floor to the wall outlet.
    pts = [(6.79, 3.07, TOP + 0.008), (6.40, 3.10, TOP + 0.004), (6.28, 3.12, TOP - 0.01), (6.24, 3.05, 0.35),
           (6.30, 2.70, 0.012), (6.42, 2.30, 0.006), (6.45, 2.185, 0.30)]
    geo.tube("Charger_Cable", pts, 0.0022, m["cable"], c)
    geo.box("Charger_Brick", (0.06, 0.06, 0.028), (6.30, 2.62, 0.0), m["cable"], c, rot=(0, 0, 20), bev=0.004)


def build_takeaway(m, c):
    """Lunch, fourteen hours ago: lid open, chopsticks laid across, barely touched."""
    tx, ty = 6.40, 3.40
    lift = 0.012                     # sits on the printout stack
    geo.cyl("Takeaway_Box", 0.055, 0.065, (tx, ty, TOP + lift), m["kraft"], c, r_top=0.068, seg=4, rot=(0, 0, 45 + 12))
    geo.box("Takeaway_Noodles", (0.075, 0.075, 0.004), (tx, ty, TOP + lift + 0.052), m["noodle"], c, rot=(0, 0, 12), bev=0.002)
    for i, ang in enumerate((25, 160)):
        geo.box(f"Takeaway_Flap_{i}", (0.09, 0.05, 0.002), (tx + 0.05 * math.cos(math.radians(ang)),
                                                          ty + 0.05 * math.sin(math.radians(ang)), TOP + lift + 0.064),
                m["kraft"], c, rot=(0, -50 if i == 0 else 50, ang), bev=0)
    for i in range(2):
        geo.cyl(f"Chopstick_{i}", 0.003, 0.22, (tx - 0.05, ty - 0.03 + i * 0.012, TOP + lift + 0.066), m["wood_stick"], c,
                rot=(0, 88, 15), seg=8, r_top=0.002)


def build_lamp(m, c):
    """Architect lamp, switched off: he works by screen light only."""
    lx, ly = 7.58, 3.48
    geo.cyl("Lamp_Base", 0.07, 0.018, (lx, ly, TOP), m["steel"], c, seg=40, bev=0.003)
    geo.tube("Lamp_Arm", [(lx, ly, TOP + 0.018), (lx - 0.03, ly - 0.02, TOP + 0.24), (lx - 0.16, ly - 0.10, TOP + 0.42)],
             0.006, m["steel"], c, handles="VECTOR")
    geo.cyl("Lamp_Shade", 0.055, 0.13, (lx - 0.16, ly - 0.10, TOP + 0.42), m["steel"], c, rot=(0, 120, -150), r_top=0.025, seg=40)


def build_chair(m, c):
    """Mesh-back task chair; seat faces +Y (desk)."""
    cx, cy = 6.95, 2.60
    for i in range(5):
        a = math.radians(90 + i * 72)
        geo.box(f"Chair_Leg_{i}", (0.30, 0.035, 0.03), (cx + 0.15 * math.cos(a), cy + 0.15 * math.sin(a), 0.06),
                m["steel"], c, rot=(0, 0, math.degrees(a)), bev=0.008)
        geo.cyl(f"Chair_Caster_{i}", 0.025, 0.04, (cx + 0.29 * math.cos(a), cy + 0.29 * math.sin(a), 0.025),
                m["rubber"], c, rot=(90, 0, math.degrees(a) + 90), seg=20)
    geo.cyl("Chair_Hub", 0.04, 0.05, (cx, cy, 0.055), m["steel"], c, seg=24)
    geo.cyl("Chair_Gas", 0.022, 0.36, (cx, cy, 0.09), m["alu"], c, seg=24)
    geo.rounded_slab("Chair_Seat", (0.50, 0.48, 0.075), 0.06, (cx, cy + 0.02, 0.45), m["fabric"], c)
    _chair_back(m, c, cx, cy)
    for sx in (-1, 1):
        geo.box(f"Chair_ArmPost_{sx}", (0.03, 0.04, 0.2), (cx + sx * 0.25, cy - 0.02, 0.47), m["steel"], c, bev=0.006)
        geo.rounded_slab(f"Chair_ArmPad_{sx}", (0.06, 0.24, 0.025), 0.02, (cx + sx * 0.25, cy + 0.02, 0.67), m["rubber"], c)
    geo.join([o for o in c.objects if o.name.startswith("Chair_")], "Office_Chair")


def _chair_back(m, c, cx, cy):
    """Curved mesh back: a bent, tapered panel on a steel spine (reads as a chair, not a board)."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=16, y_segments=20, size=0.5)
    for v in bm.verts:
        u, t = v.co.x + 0.5, v.co.y + 0.5            # u across, t up
        width = 0.46 - 0.08 * t                       # taper toward the top
        x = (u - 0.5) * width
        y = 0.06 * (2 * (u - 0.5)) ** 2 - 0.03 * math.sin(t * math.pi)   # wraps around + lumbar bulge
        z = t * 0.52
        v.co = (x, y, z)
    me = bpy.data.meshes.new("Chair_BackPanel")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Chair_BackPanel", me)
    c.objects.link(o)
    me.materials.append(m["fabric"])
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = 0.022
    sol.offset = 0
    geo.subsurf(o, 1)
    geo.smooth(o, 80)
    o.location = (cx, cy - 0.24, 0.56)
    o.rotation_euler = (math.radians(-10), 0, 0)
    geo.box("Chair_Spine", (0.05, 0.03, 0.20), (cx, cy - 0.22, 0.42), m["steel"], c, rot=(-10, 0, 0), bev=0.006)


def build_clock(m, c, hhmm=(3, 4)):
    """Wall clock behind Ivan's head: it reads over his shoulder in the face shots."""
    cx, cy, cz = 6.95, 2.16, 1.78
    geo.cyl("Clock_Body", 0.155, 0.04, (cx, cy, cz), m["clock_rim"], c, rot=(-90, 0, 0), seg=64, bev=0.004)
    geo.plane("Clock_Face", (0.29, 0.29), (cx, cy + 0.0405, cz), m["clock_face"], c, rot=(90, 0, 180))
    h, mi = hhmm
    for name, ang, length, width in (("Hour", (h % 12 + mi / 60) * 30, 0.075, 0.008), ("Minute", mi * 6, 0.115, 0.005)):
        hand = geo.box(f"Clock_{name}", (width, 0.0015, length), (0, 0, 0), m["clock_rim"], c, bev=0)
        hand.location = (cx, cy + 0.043 + (0.001 if name == "Minute" else 0), cz)
        hand.rotation_euler = (0, math.radians(-ang), 0)
    geo.cyl("Clock_Pin", 0.006, 0.006, (cx, cy + 0.042, cz), m["clock_rim"], c, rot=(-90, 0, 0), seg=16)


def build_router(m, c):
    """Router and power strip on the floor by the outlet: tiny blinking life at 3 AM."""
    geo.box("Router", (0.20, 0.13, 0.035), (6.62, 2.30, 0.0), m["router"], c, rot=(0, 0, 4), bev=0.008)
    for i in range(4):
        geo.box(f"Router_LED_{i}", (0.006, 0.003, 0.003), (6.56 + i * 0.025, 2.236, 0.02), m["led"], c, bev=0)
    geo.box("Power_Strip", (0.30, 0.055, 0.035), (6.95, 2.24, 0.0), m["router"], c, bev=0.006)
    geo.box("Power_Strip_LED", (0.008, 0.003, 0.004), (6.82, 2.212, 0.02), m["led_amber"], c, bev=0)


def build_sticky(m, c):
    geo.plane("Sticky_Desk", (0.076, 0.076), (7.08, 2.92, TOP + 0.0004), m["sticky_b"], c, rot=(0, 0, -9))


def build(hhmm=(3, 4)):
    _hide_shell()
    c = geo.coll("Desk_Hero")
    m = _mats()
    build_desk(m, c)
    build_laptop(m, c)
    build_glass(m, c)
    build_mugs(m, c)
    build_phone(m, c)
    build_notebook(m, c)
    build_mouse_and_cable(m, c)
    build_takeaway(m, c)
    build_lamp(m, c)
    build_chair(m, c)
    build_clock(m, c, hhmm)
    build_router(m, c)
    build_sticky(m, c)
    return c
