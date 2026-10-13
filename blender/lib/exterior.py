"""The city outside Ivan's windows (tier T4): seen through glass, mostly out of focus.

Ivan lives ~7 floors up (world_bible: 'parking lot directly below', 'darkness to the horizon').
Ground is 21 m below his floor. Buildings carry a procedural window-grid emission: some
windows lit warm, some cool, most dark; fewer stay lit as the night goes on.
"""
import math
import random

import bpy

import geo
import materials as M

GROUND = -21.0


def facade(name, lit_fraction, seed):
    """Concrete facade + window grid; emission only where a window is 'lit'."""
    mat = M._new(name)
    k = M.NodeKit(mat)
    p, po = k.pos()
    # Windows: brick texture in the facade plane (X/Y walls handled by using X+Y as 'u').
    sep = k.node("ShaderNodeSeparateXYZ")
    k.link(p, po, sep, 0)
    u = k.node("ShaderNodeMath", _operation="ADD")
    k.link(sep, "X", u, 0)
    k.link(sep, "Y", u, 1)
    comb = k.node("ShaderNodeCombineXYZ")
    k.link(u, 0, comb, "X")
    k.link(sep, "Z", comb, "Y")
    brick = k.node("ShaderNodeTexBrick", Scale=1.0, **{"Mortar Size": 0.45, "Brick Width": 2.2, "Row Height": 3.1,
                   "Color1": (1, 1, 1, 1), "Color2": (0, 0, 0, 1), "Mortar": (0, 0, 0, 1), "Mortar Smooth": 0.0},
                   _offset=0.0, _squash=1.0)
    k.link(comb, "Vector", brick, "Vector")
    # brick 'Color' is random per cell between Color1/Color2 -> threshold for lit cells.
    lit = k.node("ShaderNodeMath", _operation="GREATER_THAN", Value=1.0 - lit_fraction)
    gray = k.node("ShaderNodeRGBToBW")
    k.link(brick, "Color", gray, "Color")
    k.link(gray, "Val", lit, 0)
    lit.inputs[1].default_value = 1.0 - lit_fraction
    window = k.node("ShaderNodeMath", _operation="SUBTRACT")
    window.inputs[0].default_value = 1.0
    k.link(brick, "Fac", window, 1)           # Fac = 1 on mortar -> window = 1 inside cells
    on = k.node("ShaderNodeMath", _operation="MULTIPLY")
    k.link(lit, 0, on, 0)
    k.link(window, 0, on, 1)
    warmcool = k.ramp(gray, "Val", [(0.0, (0.55, 0.65, 1.0)), (0.5, (1.0, 0.72, 0.42)), (1.0, (1.0, 0.85, 0.65))])
    k.link(warmcool, "Color", k.bsdf, "Emission Color")
    k.link(on, 0, k.bsdf, "Emission Strength")
    base = k.node("ShaderNodeMix", _data_type="RGBA", Factor=1.0)
    k.link(window, 0, base, 0)
    base.inputs[6].default_value = (0.09, 0.09, 0.095, 1)     # concrete
    base.inputs[7].default_value = (0.01, 0.012, 0.016, 1)    # dark glass
    k.link(base, 2, k.bsdf, "Base Color")
    k.set(Roughness=0.6)
    mat["lit_node"] = lit.name
    return mat


def build(preset="3am"):
    c = geo.coll("Exterior")
    lit = {"3am": 0.18, "4am": 0.10, "sunrise": 0.02, "day": 0.0, "evening": 0.14}[preset]
    rnd = random.Random(21)
    facades = [facade(f"Facade_{i}", lit * rnd.uniform(0.7, 1.3), i) for i in range(4)]
    asphalt = M.concrete("Asphalt", (0.05, 0.05, 0.052))
    paint_line = M.paint("Lot Line", (0.6, 0.58, 0.5), 0.6)
    lamp_head = M.emission("Sodium Lamp", (1.0, 0.55, 0.2), 40.0 if preset not in ("sunrise", "day") else 0.0)
    beacon = M.emission("Aviation Red", (1.0, 0.05, 0.03), 60.0 if preset not in ("sunrise", "day") else 0.0)
    car_paints = [M.paint(f"Car Paint {i}", col, 0.25, coat=0.8) for i, col in
                  enumerate(((0.02, 0.02, 0.025), (0.25, 0.26, 0.28), (0.18, 0.02, 0.02), (0.55, 0.55, 0.56)))]
    tail = M.emission("Tail Light", (1.0, 0.04, 0.02), 4.0)

    # Ground plane + parking lot below the east windows.
    geo.box("Ground", (400, 400, 0.1), (5, 3.8, GROUND - 0.1), asphalt, c, bev=0)
    for i in range(16):
        geo.box(f"Lot_Line_{i}", (5.0, 0.12, 0.01), (16 + 2.6 * 0, -6 + i * 2.6, GROUND), paint_line, c, bev=0)
    for i in range(9):
        if rnd.random() < 0.35:
            continue
        cx, cy = 16.0, -4.7 + i * 2.6
        body = geo.rounded_slab(f"Car_{i}", (4.4, 1.8, 0.75), 0.35, (cx, cy, GROUND + 0.3), car_paints[i % 4], c, rot=(0, 0, 0))
        geo.rounded_slab(f"Car_Cabin_{i}", (2.3, 1.6, 0.55), 0.3, (cx - 0.2, cy, GROUND + 1.0), car_paints[i % 4], c)
        if i == 3:
            geo.box("Car_Tail_L", (0.05, 0.3, 0.1), (cx - 2.21, cy - 0.6, GROUND + 0.8), tail, c, bev=0)
            geo.box("Car_Tail_R", (0.05, 0.3, 0.1), (cx - 2.21, cy + 0.6, GROUND + 0.8), tail, c, bev=0)
    # Streetlight poles along the lot.
    steel = M.paint("Pole", (0.05, 0.05, 0.05), 0.5)
    for i, y in enumerate((-8.0, 3.0, 14.0)):
        geo.cyl(f"Pole_{i}", 0.09, 9.0, (21.0, y, GROUND), steel, c, seg=12)
        geo.box(f"Lamp_{i}", (0.7, 0.3, 0.12), (20.6, y, GROUND + 9.0), lamp_head, c, bev=0.02)
    # Buildings: a mid-rise block across the lot (east), others north and far.
    blocks = [((40, 3.8), (16, 40, 42)), ((38, -30), (20, 18, 30)), ((36, 34), (18, 22, 55)),
              ((5, 40), (34, 16, 48)), ((-30, 32), (22, 20, 38)), ((-8, 60), (26, 18, 70)),
              ((60, 20), (24, 24, 85)), ((70, -20), (30, 20, 60)), ((-40, -10), (20, 30, 30))]
    for i, ((bx, by), (sx, sy, h)) in enumerate(blocks):
        b = geo.box(f"Building_{i}", (sx, sy, h), (bx, by, GROUND), facades[i % 4], c, bev=0)
        if h > 50:
            geo.cyl(f"Beacon_{i}", 0.25, 0.4, (bx, by, GROUND + h), beacon, c, seg=12)
    # Distant skyline ring.
    for i in range(40):
        a = i / 40 * 2 * math.pi
        d = rnd.uniform(140, 220)
        h = rnd.uniform(25, 110)
        geo.box(f"Skyline_{i}", (rnd.uniform(15, 35), rnd.uniform(15, 35), h),
                (5 + math.cos(a) * d, 3.8 + math.sin(a) * d, GROUND), facades[i % 4], c, rot=(0, 0, math.degrees(a)), bev=0)
    # Our own building's facade around the flat (so the balcony doesn't float).
    own = M.concrete("Own Facade", (0.16, 0.155, 0.15))
    geo.box("Own_Building_Below", (10.4, 8.1, 20.8), (5.0, 3.85, GROUND), own, c, bev=0)
    return c
