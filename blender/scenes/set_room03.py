"""Ivan's room (scene 3 set, scenes/03-ivan-room/PLAN.md): a 4.6 x 4.2 m bedroom-study at night.

    blender -b --factory-startup -P blender/scenes/set_room03.py -- OUT_DIR [--cams hero,desk] [--res 1280x714] [--blend]
    blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/room --export

--export writes the engine set (room.glb + lights.json; lightmaps/ once baked) and the Studio reloads.

x = west->east, y = door wall (0) -> window wall (4.2), z up, metres. The window wall faces north over a
valley city. Without --export it renders the layout in Workbench (fast, for checking against ref/look_target.webp).
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import geo  # noqa: E402

W, D, H = 4.6, 4.2, 2.7            # room interior
T_EXT, T_IN = 0.30, 0.12           # window wall / other walls
WIN_X0, WIN_X1, SILL, HEAD = 1.50, 4.10, 0.86, 2.42
UNITS = 3

# name: (position, look-at, focal mm)
SHOTS = {
    "hero": ((2.70, 0.22, 1.18), (2.84, 4.2, 0.92), 24),    # the look-target angle
    "desk": ((3.95, 1.55, 1.30), (3.05, 3.55, 0.95), 35),
    "bed":  ((3.90, 0.55, 1.45), (0.60, 3.20, 0.70), 24),
}


def mat(name, rgb, rough=0.6, metal=0.0, emit=None, alpha=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit[0], 1)
        b.inputs["Emission Strength"].default_value = emit[1]
    if alpha is not None:
        b.inputs["Transmission Weight"].default_value = 1.0
        b.inputs["Roughness"].default_value = 0.0
    m.diffuse_color = (*rgb, 1)                       # Workbench shows material colours
    return m


def mats():
    return {
        "wall": mat("Wall Teal", (0.045, 0.075, 0.068), 0.9),
        "ceil": mat("Ceiling", (0.20, 0.21, 0.20), 0.95),
        "floor": mat("Floor", (0.16, 0.09, 0.05), 0.5),
        "trim": mat("Trim", (0.55, 0.55, 0.52), 0.45),
        "frame": mat("Window Frame White", (0.62, 0.62, 0.60), 0.4),
        "glass": mat("Glass", (0.9, 0.95, 0.95), alpha=True),
        "blind": mat("Blind Slat", (0.55, 0.54, 0.5), 0.5),
        "walnut": mat("Desk Walnut", (0.13, 0.055, 0.03), 0.4),
        "navy": mat("Bedding Navy", (0.03, 0.04, 0.08), 0.95),
        "rug": mat("Rug Navy", (0.025, 0.035, 0.07), 0.98),
        "sheet": mat("Pillow Linen", (0.35, 0.36, 0.38), 0.9),
        "black": mat("Monitor Black", (0.02, 0.02, 0.022), 0.45),
        "screen": mat("Monitor_Screen", (0.02, 0.03, 0.08), emit=((0.35, 0.45, 1.0), 4.0)),
        "shade": mat("Lamp Shade", (0.9, 0.62, 0.3), emit=((1.0, 0.55, 0.18), 6.0)),
        "plant": mat("Leaf", (0.04, 0.09, 0.03), 0.6),
        "pot": mat("Pot", (0.25, 0.14, 0.09), 0.7),
        "chair": mat("Chair Fabric", (0.03, 0.035, 0.06), 0.9),
        "book": mat("Books", (0.12, 0.13, 0.2), 0.7),
        "guitar": mat("Guitar Spruce", (0.55, 0.32, 0.13), 0.35),
        "sky": mat("City Card", (0.02, 0.03, 0.07), emit=((0.15, 0.2, 0.45), 0.6)),
    }


# ---------------------------------------------------------------------------------------------- shell
def build_shell(m):
    c = geo.coll("Structure")
    box = lambda n, s, l, mm: geo.box(n, s, l, mm, c, bev=0)        # noqa: E731  (centred XY, base at z)
    box("Floor", (W + 2 * T_IN, D + T_IN + T_EXT, 0.05), (W / 2, (D + T_EXT - T_IN) / 2, -0.05), m["floor"])
    box("Ceiling", (W + 2 * T_IN, D + T_IN + T_EXT, 0.05), (W / 2, (D + T_EXT - T_IN) / 2, H), m["ceil"])
    box("Wall_W", (T_IN, D + T_IN + T_EXT, H), (-T_IN / 2, (D + T_EXT - T_IN) / 2, 0), m["wall"])
    box("Wall_E", (T_IN, D + T_IN + T_EXT, H), (W + T_IN / 2, (D + T_EXT - T_IN) / 2, 0), m["wall"])
    # south wall with the door opening (x 0.55..1.45, 2.1 high)
    box("Wall_S_a", (0.55, T_IN, H), (0.275, -T_IN / 2, 0), m["wall"])
    box("Wall_S_b", (W - 1.45, T_IN, H), ((W + 1.45) / 2, -T_IN / 2, 0), m["wall"])
    box("Wall_S_head", (0.90, T_IN, H - 2.1), (1.0, -T_IN / 2, 2.1), m["wall"])
    box("Door", (0.86, 0.04, 2.08), (1.0, -0.02, 0.0), m["trim"])
    # north wall around the window opening
    yN = D + T_EXT / 2
    box("Wall_N_w", (WIN_X0, T_EXT, H), (WIN_X0 / 2, yN, 0), m["wall"])
    box("Wall_N_e", (W - WIN_X1, T_EXT, H), ((W + WIN_X1) / 2, yN, 0), m["wall"])
    box("Wall_N_sill", (WIN_X1 - WIN_X0, T_EXT, SILL), ((WIN_X0 + WIN_X1) / 2, yN, 0), m["wall"])
    box("Wall_N_head", (WIN_X1 - WIN_X0, T_EXT, H - HEAD), ((WIN_X0 + WIN_X1) / 2, yN, HEAD), m["wall"])
    # skirting
    for n, s, l in (("Skirting_W", (0.015, D, 0.09), (0.0075, D / 2, 0)), ("Skirting_E", (0.015, D, 0.09), (W - 0.0075, D / 2, 0)),
                    ("Skirting_N", (W, 0.015, 0.09), (W / 2, D - 0.0075, 0)), ("Skirting_S", (W - 1.45, 0.015, 0.09), ((W + 1.45) / 2, 0.0075, 0))):
        box(n, s, l, m["trim"])


def build_window(m):
    """Three double-hung units in a white frame, interior casing + deep sill board, blinds pulled up."""
    c = geo.coll("Structure")
    box = lambda n, s, l, mm: geo.box(n, s, l, mm, c, bev=0.002)    # noqa: E731
    cx, wd = (WIN_X0 + WIN_X1) / 2, WIN_X1 - WIN_X0
    yF = D + 0.17                                  # frame plane inside the wall depth
    # casing on the room face
    box("Casing_L", (0.09, 0.02, HEAD - SILL + 0.09), (WIN_X0 - 0.045, D - 0.01, SILL - 0.0), m["frame"])
    box("Casing_R", (0.09, 0.02, HEAD - SILL + 0.09), (WIN_X1 + 0.045, D - 0.01, SILL - 0.0), m["frame"])
    box("Casing_T", (wd + 0.18, 0.02, 0.09), (cx, D - 0.01, HEAD), m["frame"])
    box("Window_Stool", (wd + 0.26, 0.24, 0.03), (cx, D + 0.07, SILL - 0.03), m["frame"])
    box("Window_Apron", (wd + 0.14, 0.02, 0.08), (cx, D - 0.01, SILL - 0.11), m["frame"])
    # reveal lining (jambs/head/sill inside the wall)
    box("Lining_L", (0.02, T_EXT - 0.02, HEAD - SILL), (WIN_X0 + 0.01, D + T_EXT / 2, SILL), m["frame"])
    box("Lining_R", (0.02, T_EXT - 0.02, HEAD - SILL), (WIN_X1 - 0.01, D + T_EXT / 2, SILL), m["frame"])
    box("Lining_T", (wd, T_EXT - 0.02, 0.02), (cx, D + T_EXT / 2, HEAD - 0.02), m["frame"])
    uw = wd / UNITS
    for i in range(UNITS):
        x0 = WIN_X0 + i * uw
        ux = x0 + uw / 2
        # mullions between units
        if i:
            box(f"Frame_Mullion_{i}", (0.10, 0.12, HEAD - SILL), (x0, yF, SILL), m["frame"])
        mid = (SILL + HEAD) / 2
        for k, (z0, z1, dy) in enumerate(((SILL + 0.02, mid + 0.02, -0.03), (mid - 0.02, HEAD - 0.02, 0.03))):
            # sash: stiles + rails + one vertical muntin, glass behind
            sy = yF + dy
            sw, sh = uw - 0.08, z1 - z0
            box(f"Frame_Sash{i}{k}_L", (0.05, 0.045, sh), (x0 + 0.04 + 0.025, sy, z0), m["frame"])
            box(f"Frame_Sash{i}{k}_R", (0.05, 0.045, sh), (x0 + uw - 0.04 - 0.025, sy, z0), m["frame"])
            box(f"Frame_Sash{i}{k}_B", (sw, 0.045, 0.06), (ux, sy, z0), m["frame"])
            box(f"Frame_Sash{i}{k}_T", (sw, 0.045, 0.05), (ux, sy, z1 - 0.05), m["frame"])
            box(f"Frame_Muntin{i}{k}", (0.022, 0.03, sh), (ux, sy, z0), m["frame"])
            g = geo.plane(f"Window_Glass{i}{k}", (sw, sh), (ux, sy + 0.01, z0 + sh / 2), m["glass"], c, rot=(90, 0, 0))
    build_blinds(m, cx, wd)


def build_blinds(m, cx, wd):
    """Venetian blinds pulled almost all the way up: a stack of slats under the head rail + cords."""
    c = geo.coll("Blinds")
    top = HEAD - 0.02
    geo.box("Blind_HeadRail", (wd - 0.04, 0.05, 0.05), (cx, D + 0.05, top - 0.05), m["blind"], c, bev=0.004)
    n = 22
    for k in range(n):
        z = top - 0.07 - k * 0.0105
        geo.box(f"Blind_Slat_{k:02d}", (wd - 0.06, 0.05, 0.003), (cx, D + 0.05, z), m["blind"], c,
                rot=(12 * (1 if k % 2 else -1), 0, 0), bev=0)
    geo.box("Blind_BottomRail", (wd - 0.06, 0.05, 0.02), (cx, D + 0.05, top - 0.07 - n * 0.0105 - 0.02), m["blind"], c, bev=0.003)
    for x in (cx - wd / 2 + 0.35, cx + wd / 2 - 0.35):
        geo.box("Blind_Cord", (0.004, 0.004, 0.75), (x, D + 0.02, top - 0.8), m["blind"], c, bev=0)


# ---------------------------------------------------------------------------------------------- grey-box furniture
def build_blocks(m):
    """Placeholders at the planned sizes; replaced prop by prop with real assets."""
    c = geo.coll("Blocks")
    b = lambda n, s, l, mm, r=(0, 0, 0): geo.box(n, s, l, mm, c, rot=r, bev=0.01)   # noqa: E731
    # bed: low walnut platform, head on the west wall, long side along the window wall
    b("Bed_Frame", (2.05, 1.45, 0.28), (1.025, 3.08, 0.0), m["walnut"])
    b("Bed_Mattress", (2.0, 1.4, 0.22), (1.02, 3.08, 0.28), m["navy"])
    b("Bed_Pillow", (0.4, 0.9, 0.13), (0.28, 3.08, 0.5), m["sheet"])
    # nightstand + table lamp, NW corner
    b("Nightstand", (0.48, 0.42, 0.58), (0.26, 3.96, 0.0), m["walnut"])
    geo.cyl("Lamp_Base", 0.05, 0.38, (0.26, 3.98, 0.58), m["walnut"], c)
    geo.cyl("Lamp_Shade", 0.17, 0.26, (0.26, 3.98, 0.92), m["shade"], c, r_top=0.12, cap=False)
    # main desk under the right of the window, drawer pedestal on its right
    b("Desk_Top", (1.92, 0.68, 0.04), (3.10, 3.86, 0.72), m["walnut"])
    b("Desk_Pedestal", (0.45, 0.64, 0.72), (3.83, 3.86, 0.0), m["walnut"])
    b("Desk_Leg_L", (0.05, 0.62, 0.72), (2.17, 3.86, 0.0), m["walnut"])
    b("Desk_Modesty", (1.4, 0.03, 0.4), (2.88, 4.18, 0.32), m["walnut"])
    # two monitors + laptop
    b("Monitor_L", (0.56, 0.03, 0.34), (2.78, 4.02, 0.95), m["black"], (0, 0, 12))
    b("Monitor_R", (0.62, 0.03, 0.37), (3.40, 4.04, 0.95), m["black"], (0, 0, -6))
    # screens are UV'd planes facing the room: screens.js draws the code onto them
    geo.plane("Monitor_Screen_L", (0.53, 0.31), (2.775, 4.002, 1.12), m["screen"], c, rot=(90, 0, 12))
    geo.plane("Monitor_Screen", (0.59, 0.34), (3.398, 4.022, 1.135), m["screen"], c, rot=(90, 0, -6))
    b("Laptop", (0.34, 0.24, 0.015), (3.00, 3.70, 0.76), m["black"])
    b("Laptop_Lid", (0.34, 0.012, 0.22), (3.00, 3.83, 0.775), m["black"], (-12, 0, 0))
    geo.plane("Laptop_Screen", (0.32, 0.20), (3.00, 3.80, 0.885), m["screen"], c, rot=(78, 0, 0))
    # chair, turned a little toward the room, hoodie on the back
    b("Chair_Seat", (0.5, 0.5, 0.1), (3.35, 3.22, 0.42), m["chair"], (0, 0, -16))
    b("Chair_Back", (0.48, 0.08, 0.62), (3.42, 3.46, 0.55), m["chair"], (0, 0, -16))
    geo.cyl("Chair_Post", 0.03, 0.42, (3.35, 3.22, 0.0), m["black"], c)
    # bookshelf on the east wall + guitar leaning on it
    b("Bookshelf", (0.34, 1.15, 2.0), (W - 0.17, 3.48, 0.0), m["walnut"])
    b("Books", (0.26, 1.05, 1.5), (W - 0.2, 3.48, 0.3), m["book"])
    b("Guitar", (0.38, 0.11, 1.0), (W - 0.55, 2.82, 0.0), m["guitar"], (0, -8, 0))
    # east-wall desk/shelf, south low shelf (foreground blur), big plant (SE)
    b("East_Cabinet", (0.42, 0.85, 0.78), (W - 0.21, 1.95, 0.0), m["walnut"])
    b("South_Shelf", (1.5, 0.4, 0.72), (3.2, 0.2, 0.0), m["walnut"])
    geo.cyl("Plant_Pot", 0.2, 0.38, (W - 0.4, 0.45, 0.0), m["pot"], c)
    geo.cyl("Plant_Leaves", 0.45, 1.1, (W - 0.4, 0.45, 0.38), m["plant"], c, r_top=0.2)
    geo.cyl("Plant_Pot_W", 0.17, 0.32, (0.35, 0.95, 0.0), m["pot"], c)
    geo.cyl("Plant_Leaves_W", 0.4, 0.9, (0.35, 0.95, 0.32), m["plant"], c, r_top=0.15)
    # floor mattress on the rug, middle of the room
    b("Rug", (2.4, 1.7, 0.012), (2.55, 2.10, 0.0), m["rug"])
    b("Floor_Mattress", (1.35, 1.9, 0.16), (2.25, 1.95, 0.012), m["navy"], (0, 0, 4))
    b("Floor_Pillow", (0.55, 0.35, 0.12), (2.25, 2.70, 0.17), m["sheet"], (0, 0, 4))


def build_view_card(m):
    """Grey-box stand-in for the city: one emissive card well beyond the window."""
    c = geo.coll("Exterior")
    geo.plane("City_Card", (40, 14), (2.8, 30, 0), m["sky"], c, rot=(90, 0, 0))


def add_cams():
    c = geo.coll("Shots")
    cams = {}
    for name, (pos, at, mm) in SHOTS.items():
        data = bpy.data.cameras.new(f"Shot_{name}")
        data.lens, data.sensor_width, data.clip_start = mm, 36, 0.02
        o = bpy.data.objects.new(f"Shot_{name}", data)
        c.objects.link(o)
        o.location = pos
        o.rotation_euler = (Vector(at) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
        cams[name] = o
    return cams


def build(grey=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    m = mats()
    build_shell(m)
    build_window(m)
    build_blocks(m)
    build_view_card(m)
    return scene, add_cams()


def render_grey(scene, cams, names, out, res):
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light, sh.color_type = "STUDIO", "MATERIAL"
    sh.show_shadows, sh.show_cavity = True, True
    sh.shadow_intensity = 0.6
    scene.display.light_direction = (0.3, -0.5, 0.8)
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.view_settings.view_transform = "Standard"
    paths = []
    for n in names:
        scene.camera = cams[n]
        scene.render.filepath = str(out / f"grey_{n}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


def export(out):
    """room.glb + lights.json for engine/scenes/s03 (the Studio reloads when they change)."""
    import json
    ob = bpy.data.objects
    at = lambda n: [round(v, 4) for v in ob[n].matrix_world.translation]   # noqa: E731
    lights = [
        # the table lamp: atmosphere.js hangs its warm cone on 'Desk_Lamp'
        {"name": "Desk_Lamp", "type": "POINT", "energy_w": 40, "color": [1.0, 0.62, 0.32], "location": [0.26, D - 0.22, 1.05],
         "forward": [0, 0, -1], "spot_deg": 120, "blend": 1, "radius": 0.05},
        {"name": "Key_Laptop", "type": "AREA", "energy_w": 6, "color": [0.7, 0.8, 1.0], "location": at("Laptop_Screen"),
         "forward": [0, -1, 0], "size": [0.33, 0.21]},
    ]
    marks = {n: at(n) for n in ("Lamp_Shade", "Laptop_Screen", "Monitor_Screen", "Monitor_Screen_L") if n in ob}
    marks["Window"] = [(WIN_X0 + WIN_X1) / 2, D + 0.17, (SILL + HEAD) / 2]
    out.mkdir(parents=True, exist_ok=True)
    (out / "lights.json").write_text(json.dumps({"lights": lights, "marks": marks, "exposure": 0,
                                                "room": {"w": W, "d": D, "h": H, "window": [WIN_X0, WIN_X1, SILL, HEAD]}}, indent=1))
    for o in ob:                                     # Workbench-only cameras are not part of the set
        if o.type == "CAMERA":
            o.hide_render = True
    bpy.ops.export_scene.gltf(filepath=str(out / "room.glb"), export_format="GLB", export_apply=True, export_cameras=False,
                              export_lights=False, export_yup=True, export_extras=True, export_animations=False)
    print("EXPORTED", out / "room.glb", round((out / "room.glb").stat().st_size / 1e6, 2), "MB", flush=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    opt = lambda f, d: args[args.index(f) + 1] if f in args else d   # noqa: E731
    scene, cams = build()
    if "--export" in args:
        export(out)
        sys.exit(0)
    if "--blend" in args:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "room03.blend"))
    res = tuple(int(v) for v in opt("--res", "1280x714").split("x"))
    print("rendered", render_grey(scene, cams, opt("--cams", "hero").split(","), out, res))
