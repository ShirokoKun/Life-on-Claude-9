"""Ivan's apartment: the architectural shell + grey-box furniture, built entirely from code.

Run headless (no Blender UI needed):
    python blender/scenes/apartment_shell.py OUT_DIR [--blend] [--render DIR] [--no-export]

    OUT_DIR       receives index.html + models/*.glb via the vendored three-blender exporter
    --blend       also saves OUT_DIR/apartment_shell.blend
    --render DIR  renders Cycles stills of the three scouting cameras into DIR
                  (shell_plan.png, shell_wide.png, shell_desk.png)
    --no-export   skip the three.js export (handy while iterating on renders)

Every dimension lives in the APT dict below; docs/APARTMENT_SPEC.md explains the numbers.
Coordinates: metres, origin at the bottom-left (south-west) exterior corner of the sketch,
+X = east (right on the sketch), +Y = north (up on the sketch), +Z = up, finished floor at z=0.
Grey/neutral materials only: this is Phase 2 (shell) of docs/ROOM_WORKFLOW.md.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "vendor"))

import three_blender  # noqa: E402
from three_blender.exporter import SceneExporter  # noqa: E402

# --------------------------------------------------------------------------------------
# DATA: edit numbers here, rebuild, done.
# Boxes are (x0, y0, x1, y1) in plan. Openings sit on a wall at `at` (centre, measured on
# the wall's long axis in world coordinates), `width`, `sill` and `head` heights.
# --------------------------------------------------------------------------------------
APT = {
    "footprint": (10.0, 7.7),
    "ceiling": 2.7,
    "slab": 0.2,  # structural floor/ceiling slab thickness
    "ext_wall": 0.25,
    "int_wall": 0.12,
    # Interior floor = these rects (the balcony is outside them).
    "interior": [(0.0, 0.0, 10.0, 5.55), (6.05, 5.55, 10.0, 7.7)],
    "walls": [
        # Exterior (0.25 m). Run from slab bottom to slab top.
        {"id": "S", "kind": "ext", "box": (0.0, 0.0, 10.0, 0.25), "openings": [
            {"id": "MainDoor", "type": "door", "at": 4.62, "width": 1.0, "head": 2.1,
             "hinge": "L", "swing_to": (4.6, 1.0), "angle": 0, "room": "Entry"},
        ]},
        {"id": "W", "kind": "ext", "box": (0.0, 0.0, 0.25, 5.55), "openings": []},
        {"id": "E", "kind": "ext", "box": (9.75, 0.0, 10.0, 7.7), "openings": [
            {"id": "EastWindow", "type": "window", "at": 3.6, "width": 2.4, "sill": 0.75,
             "head": 2.3, "cols": 3, "room": "Dining"},
        ]},
        {"id": "N", "kind": "ext", "box": (6.05, 7.45, 10.0, 7.7), "openings": []},
        {"id": "KitchenW", "kind": "ext", "box": (6.05, 5.3, 6.3, 7.7), "openings": []},
        {"id": "Balcony", "kind": "ext", "box": (0.0, 5.3, 6.3, 5.55), "openings": [
            {"id": "BedroomWindow", "type": "window", "at": 1.2, "width": 1.4, "sill": 0.9,
             "head": 2.2, "cols": 2, "room": "Bedroom"},
            {"id": "BalconyDoor", "type": "slider", "at": 4.6, "width": 2.2, "sill": 0.0,
             "head": 2.3, "room": "Living"},
        ]},
        # Interior partitions (0.12 m). Ends overlap their neighbours by 5 cm so the joints are clean.
        {"id": "BedHall", "kind": "int", "box": (2.64, 0.2, 2.76, 5.35), "openings": [
            {"id": "BedroomDoor", "type": "door", "at": 2.7, "width": 0.8, "head": 2.05,
             "hinge": "L", "swing_to": (1.5, 2.7), "angle": 60, "room": "Bedroom"},
        ]},
        {"id": "BathW_N", "kind": "int", "box": (0.2, 2.04, 2.7, 2.16), "openings": [
            {"id": "BathWDoor", "type": "door", "at": 0.825, "width": 0.75, "head": 2.05,
             "hinge": "L", "swing_to": (0.8, 1.2), "angle": 55, "room": "Bath_W"},
        ]},
        {"id": "BathE_W", "kind": "int", "box": (5.89, 0.2, 6.01, 2.16), "openings": []},
        {"id": "BathE_N", "kind": "int", "box": (5.89, 2.04, 9.8, 2.16), "openings": [
            {"id": "BathEDoor", "type": "door", "at": 9.175, "width": 0.75, "head": 2.05,
             "hinge": "R", "swing_to": (9.2, 1.2), "angle": 45, "room": "Bath_E"},
        ]},
    ],
    # Zones for collections, skirting and ceiling lights. First match wins.
    "rooms": {
        "Bedroom": (0.25, 2.16, 2.64, 5.3),
        "Bath_W": (0.25, 0.25, 2.64, 2.04),
        "Bath_E": (6.01, 0.25, 9.75, 2.04),
        "Entry": (2.76, 0.25, 5.89, 2.16),
        "Desk": (5.89, 2.16, 7.9, 3.7),
        "Living": (2.76, 2.16, 6.3, 5.3),
        "Dining": (6.3, 2.16, 9.75, 5.2),
        "Kitchen": (6.3, 5.2, 9.75, 7.45),
        "Balcony": (0.0, 5.55, 6.05, 7.7),
    },
    "balcony": {"slab": (0.0, 5.55, 6.05, 7.7), "drop": 0.03, "rail_height": 1.1,
                "rail_runs": [((0.08, 7.62), (6.05, 7.62)), ((0.08, 5.55), (0.08, 7.62))]},
    # Ceiling fixtures: room -> (x, y). One light each.
    "ceiling_lights": {
        "Living": (4.3, 3.8), "Entry": (4.3, 1.2), "Dining": (8.6, 4.35),
        "Kitchen": (8.0, 6.35), "Bedroom": (1.45, 3.7), "Bath_W": (1.45, 1.15),
        "Bath_E": (7.9, 1.15), "Balcony": (3.0, 6.6),
    },
    # Wall plates: (kind, room, x, y, z, facing) with facing = the direction the plate faces.
    "plates": [
        ("Switch", "Entry", 5.35, 0.25, 1.1, "+y"),
        ("Switch", "Entry", 3.6, 0.25, 1.1, "+y"),
        ("Switch", "Bedroom", 2.64, 3.3, 1.1, "-x"),
        ("Switch", "Bedroom", 1.35, 2.16, 1.1, "+y"),
        ("Switch", "Living", 2.76, 3.25, 1.1, "+x"),
        ("Switch", "Bath_E", 8.6, 2.16, 1.1, "+y"),
        ("Switch", "Kitchen", 6.3, 5.75, 1.1, "+x"),
        ("Outlet", "Desk", 7.35, 2.16, 0.3, "+y"),
        ("Outlet", "Desk", 6.45, 2.16, 0.3, "+y"),
        ("Outlet", "Living", 2.76, 4.5, 0.3, "+x"),
        ("Outlet", "Entry", 5.89, 1.0, 0.3, "-x"),
        ("Outlet", "Bedroom", 0.25, 4.3, 0.3, "+x"),
        ("Outlet", "Bedroom", 2.64, 4.4, 0.3, "-x"),
        ("Outlet", "Kitchen", 7.0, 7.45, 1.1, "-y"),
        ("Outlet", "Kitchen", 8.6, 7.45, 1.1, "-y"),
        ("Outlet", "Dining", 9.75, 5.0, 0.3, "-x"),
        ("Outlet", "Bath_W", 1.15, 0.25, 1.1, "+y"),
        ("Outlet", "Bath_E", 7.65, 0.25, 1.1, "+y"),
        ("Thermostat", "Entry", 2.76, 1.6, 1.5, "+x"),
    ],
    # Furniture: (item, room, kind, (w, d, h), (x, y, z_base), rot_deg).
    # w along local X, d along local Y. rot 0 = the item's front (user side) faces -Y (south);
    # rot 90 -> faces +X (east), 180 -> +Y (north), -90 -> -X (west).
    "furniture": [
        ("BookDrawer", "Living", "drawer_books", (0.8, 0.4, 0.9), (2.96, 3.9, 0), 90),
        ("FloorLamp", "Living", "floor_lamp", (0.3, 0.3, 1.75), (3.0, 5.02, 0), 0),
        ("BeanBag", "Living", "bean_bag", (0.85, 0.85, 0.6), (3.68, 4.6, 0), 0),
        ("ShoeRack", "Entry", "shoe_rack", (0.8, 0.32, 0.5), (2.92, 0.75, 0), 90),
        ("Desk", "Desk", "desk", (1.4, 0.7, 0.75), (6.95, 2.52, 0), 180),
        ("OfficeChair", "Desk", "office_chair", (0.62, 0.62, 1.15), (6.95, 3.3, 0), 0),
        ("Laptop", "Desk", "laptop", (0.31, 0.22, 0.22), (6.95, 2.56, 0.75), 180),
        ("DeskLamp", "Desk", "desk_lamp", (0.16, 0.16, 0.45), (7.47, 2.33, 0.75), 180),
        ("WallClock", "Desk", "clock", (0.3, 0.04, 0.3), (6.95, 2.18, 1.6), 180),
        ("DiningTable", "Dining", "round_table", (0.9, 0.9, 0.75), (8.6, 4.35, 0), 0),
        ("DiningChair_W", "Dining", "chair", (0.45, 0.48, 0.9), (7.95, 4.35, 0), 90),
        ("DiningChair_E", "Dining", "chair", (0.45, 0.48, 0.9), (9.25, 4.35, 0), -90),
        ("Pantry", "Kitchen", "tall_cabinet", (0.6, 0.62, 2.2), (6.6, 7.14, 0), 0),
        ("CounterRun", "Kitchen", "counter", (2.15, 0.62, 0.9), (7.975, 7.14, 0), 0),
        ("Sink", "Kitchen", "sink", (0.7, 0.45, 0.25), (7.35, 7.12, 0.9), 0),
        ("Cooktop", "Kitchen", "cooktop", (0.6, 0.52, 0.02), (8.2, 7.14, 0.9), 0),
        ("CoffeeMaker", "Kitchen", "box", (0.22, 0.26, 0.36), (8.72, 7.25, 0.9), 0),
        ("Fridge", "Kitchen", "fridge", (0.7, 0.65, 1.85), (9.4, 7.12, 0), 0),
        ("UpperCabinets", "Kitchen", "upper_cabinets", (2.15, 0.35, 0.72), (7.975, 7.275, 1.5), 0),
        ("Island", "Kitchen", "counter", (2.45, 0.65, 0.92), (8.525, 5.525, 0), 180),
        ("Bed", "Bedroom", "bed", (1.4, 1.9, 0.55), (1.2, 3.7, 0), 90),
        ("BedsideDrawer", "Bedroom", "drawer", (0.45, 0.4, 0.55), (0.45, 4.67, 0), 90),
        ("BedsideLamp", "Bedroom", "table_lamp", (0.22, 0.22, 0.42), (0.45, 4.7, 0.55), 0),
        ("ShowerTray", "Bath_W", "shower", (0.9, 0.9, 2.0), (0.7, 0.7, 0), 90),
        ("Toilet_W", "Bath_W", "toilet", (0.38, 0.68, 0.8), (2.3, 0.95, 0), -90),
        ("Vanity_W", "Bath_W", "vanity", (0.6, 0.45, 0.85), (1.6, 0.475, 0), 180),
        ("Toilet_E", "Bath_E", "toilet", (0.38, 0.68, 0.8), (6.35, 1.0, 0), 90),
        ("Vanity_E", "Bath_E", "vanity", (0.6, 0.45, 0.85), (7.2, 0.475, 0), 180),
        ("Bathtub", "Bath_E", "tub", (1.7, 0.75, 0.55), (8.9, 0.625, 0), 0),
    ],
    "skirting": {"height": 0.08, "thickness": 0.012},
    "door": {"leaf": 0.04, "lining": 0.02, "casing": 0.07, "casing_t": 0.015},
    "window": {"frame": 0.06, "mullion": 0.05, "depth": 0.07, "glass": 0.008},
    # Sunrise key: the dining window faces EAST. Azimuth from north, clockwise.
    "sun": {"azimuth": 100.0, "elevation": 12.0, "strength": 3.0},
}

BEVEL = 0.006  # default hard-edge bevel (m)


# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------
def material(name, grey, roughness=0.7, metallic=0.0, transmission=0.0, ior=1.45):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (grey, grey, grey, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Transmission Weight"].default_value = transmission
    mat.diffuse_color = (grey, grey, grey, 1.0 if transmission == 0 else 0.3)
    return mat


class Parts:
    """Accumulates boxes and cylinders into one bmesh, so each furniture item is one mesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _mat_index(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def box(self, x0, y0, z0, x1, y1, z1, mat, bevel=BEVEL):
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        z0, z1 = sorted((z0, z1))
        size = (x1 - x0, y1 - y0, z1 - z0)
        centre = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        m = Matrix.Translation(centre) @ Matrix.Diagonal((*size, 1.0))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        verts = res["verts"]
        idx = self._mat_index(mat)
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.material_index = idx
        bevel = min(bevel, 0.45 * min(size))
        if bevel > 0.0005:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type="OFFSET",
                            segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
        return self

    def cyl(self, cx, cy, z0, z1, r, mat, r_top=None, segments=32, axis="Z"):
        depth = z1 - z0
        if axis == "Z":
            m = Matrix.Translation((cx, cy, (z0 + z1) / 2))
        else:  # cylinder lying along local Y (e.g. clock face), z0..z1 are y extents
            m = Matrix.Translation((cx, (z0 + z1) / 2, cy)) @ Matrix.Rotation(math.radians(90), 4, "X")
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments,
                                    radius1=r, radius2=r if r_top is None else r_top,
                                    depth=depth, matrix=m)
        idx = self._mat_index(mat)
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = idx
        return self

    def sphere(self, cx, cy, cz, r, mat, scale=(1, 1, 1)):
        m = Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((*scale, 1.0))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=32, v_segments=16, radius=r, matrix=m)
        idx = self._mat_index(mat)
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = idx
        return self

    def to_object(self, name, coll, location=(0, 0, 0), rot_deg=0.0, smooth_angle=35.0):
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(mat)
        finish_mesh(mesh, smooth_angle)
        obj = bpy.data.objects.new(name, mesh)
        obj.location = location
        obj.rotation_euler.z = math.radians(rot_deg)
        coll.objects.link(obj)
        return obj


def finish_mesh(mesh, smooth_angle=35.0):
    mesh.shade_smooth()
    mesh.set_sharp_from_angle(angle=math.radians(smooth_angle))


def box_obj(name, ext, mat, coll, bevel=BEVEL):
    """Single box from world extents ((x0, y0, z0), (x1, y1, z1))."""
    (x0, y0, z0), (x1, y1, z1) = ext
    return Parts().box(x0, y0, z0, x1, y1, z1, mat, bevel).to_object(name, coll)


def bake_modifiers(obj):
    """Apply the modifier stack without bpy.ops (works headless)."""
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.data = baked
    bpy.data.meshes.remove(old)
    baked.name = obj.name


def inside(rects, x, y):
    return any(x0 < x < x1 and y0 < y < y1 for (x0, y0, x1, y1) in rects)


def room_at(x, y):
    for name, (x0, y0, x1, y1) in APT["rooms"].items():
        if x0 - 1e-6 <= x <= x1 + 1e-6 and y0 - 1e-6 <= y <= y1 + 1e-6:
            return name
    return "Structure"


class WallFrame:
    """Local frame of an axis-aligned wall: u along the wall, v across it, origin on the centreline."""

    def __init__(self, wall):
        x0, y0, x1, y1 = wall["box"]
        self.along_x = (x1 - x0) >= (y1 - y0)
        self.thickness = (y1 - y0) if self.along_x else (x1 - x0)
        self.centre = (y0 + y1) / 2 if self.along_x else (x0 + x1) / 2
        self.u_range = (x0, x1) if self.along_x else (y0, y1)
        # along X: u=+X, v=+Y (rot 0).  along Y: u=+Y, v=-X (rot 90).
        self.rot = 0.0 if self.along_x else 90.0

    def world(self, u, v):
        if self.along_x:
            return Vector((u, self.centre + v))
        return Vector((self.centre - v, u))

    def v_sign_towards(self, x, y):
        if self.along_x:
            return 1.0 if y > self.centre else -1.0
        return 1.0 if x < self.centre else -1.0

    def interior_side(self):
        """+1 if the +v side of the wall is inside the flat."""
        u = sum(self.u_range) / 2
        p = self.world(u, self.thickness / 2 + 0.3)
        return 1.0 if inside(APT["interior"], p.x, p.y) else -1.0


# --------------------------------------------------------------------------------------
# builders
# --------------------------------------------------------------------------------------
def build_slabs(m, colls):
    slab, ceil_z = APT["slab"], APT["ceiling"]
    floor = Parts()
    ceiling = Parts()
    for (x0, y0, x1, y1) in APT["interior"]:
        floor.box(x0, y0, -slab, x1, y1, 0.0, m["floor"], bevel=0)
        ceiling.box(x0, y0, ceil_z, x1, y1, ceil_z + slab, m["ceiling"], bevel=0)
    floor.to_object("Floor", colls["Structure"])
    ceiling.to_object("Ceiling", colls["Structure"])
    b = APT["balcony"]
    x0, y0, x1, y1 = b["slab"]
    drop = b["drop"]
    box_obj("Balcony_Slab", ((x0, y0, -slab - drop), (x1, y1, -drop)), m["concrete"],
            colls["Balcony"], bevel=0.01)
    # Underside of the balcony above (it is a recessed loggia).
    box_obj("Balcony_Soffit", ((x0, y0, ceil_z), (x1, y1, ceil_z + slab)), m["concrete"],
            colls["Balcony"], bevel=0.01)


def build_walls(m, colls):
    """Union every wall of a kind into one mesh, cut real openings with booleans, bevel."""
    slab, ceil_z = APT["slab"], APT["ceiling"]
    tmp = bpy.data.collections.new("_tmp_cutters")
    bpy.context.scene.collection.children.link(tmp)
    results = []
    for kind, z0, z1 in (("ext", -slab, ceil_z + slab), ("int", 0.0, ceil_z)):
        walls = [w for w in APT["walls"] if w["kind"] == kind]
        pieces = []
        for w in walls:
            x0, y0, x1, y1 = w["box"]
            pieces.append(box_obj(f"_piece_{w['id']}", ((x0, y0, z0), (x1, y1, z1)),
                                  m["plaster"], tmp, bevel=0))
        cutters = []
        for w in walls:
            f = WallFrame(w)
            for op in w["openings"]:
                sill = op.get("sill", 0.0)
                bottom = -slab - 1 if sill <= 0 else sill
                a = f.world(op["at"] - op["width"] / 2, -f.thickness)
                b = f.world(op["at"] + op["width"] / 2, f.thickness)
                cutters.append(box_obj(f"_cut_{op['id']}", ((min(a.x, b.x), min(a.y, b.y), bottom),
                                                            (max(a.x, b.x), max(a.y, b.y), op["head"])),
                                       m["plaster"], tmp, bevel=0))
        base = pieces[0]
        others = bpy.data.collections.new(f"_union_{kind}")
        cuts = bpy.data.collections.new(f"_cuts_{kind}")
        for p in pieces[1:]:
            others.objects.link(p)
        for c in cutters:
            cuts.objects.link(c)
        if pieces[1:]:
            mod = base.modifiers.new("union", "BOOLEAN")
            mod.operation, mod.operand_type, mod.collection = "UNION", "COLLECTION", others
            mod.solver = "EXACT"
        if cutters:
            mod = base.modifiers.new("openings", "BOOLEAN")
            mod.operation, mod.operand_type, mod.collection = "DIFFERENCE", "COLLECTION", cuts
            mod.solver = "EXACT"
        bake_modifiers(base)
        bev = base.modifiers.new("bevel", "BEVEL")
        bev.width, bev.segments, bev.limit_method = BEVEL, 2, "ANGLE"
        bev.angle_limit = math.radians(30)
        bev.harden_normals = False
        bake_modifiers(base)
        finish_mesh(base.data)
        base.name = "Walls_Exterior" if kind == "ext" else "Walls_Interior"
        base.data.name = base.name
        tmp.objects.unlink(base)
        colls["Structure"].objects.link(base)
        for o in pieces[1:] + cutters:
            bpy.data.objects.remove(o)
        bpy.data.collections.remove(others)
        bpy.data.collections.remove(cuts)
        results.append(base)
    bpy.data.collections.remove(tmp)
    return results


def build_door(wall, op, m, colls):
    d = APT["door"]
    f = WallFrame(wall)
    t, w, h = f.thickness, op["width"], op["head"]
    lin, cas, cas_t = d["lining"], d["casing"], d["casing_t"]
    coll = colls[op["room"]]
    centre = f.world(op["at"], 0.0)
    frame = Parts()
    # Linings in the reveal, then architraves on both faces.
    for s in (-1, 1):
        u_in = s * (w / 2 - lin)
        frame.box(u_in, -t / 2 - 0.005, 0, s * w / 2, t / 2 + 0.005, h, m["trim"], bevel=0.002)
    frame.box(-w / 2, -t / 2 - 0.005, h - lin, w / 2, t / 2 + 0.005, h, m["trim"], bevel=0.002)
    for side in (-1, 1):
        v0 = side * (t / 2)
        v1 = side * (t / 2 + cas_t)
        for s in (-1, 1):
            frame.box(s * (w / 2 - 0.01), v0, 0, s * (w / 2 + cas), v1, h + cas, m["trim"], bevel=0.004)
        frame.box(-w / 2 - cas, v0, h - 0.01, w / 2 + cas, v1, h + cas, m["trim"], bevel=0.004)
    if op["id"] == "MainDoor":
        frame.box(-w / 2, -t / 2, 0, w / 2, t / 2, 0.015, m["trim"], bevel=0.003)  # threshold
    frame.to_object(f"Door_{op['id']}_Frame", coll, (centre.x, centre.y, 0), f.rot)

    # Leaf: origin on the hinge axis so it can be animated later.
    swing = f.v_sign_towards(*op["swing_to"])
    hinge_u = -w / 2 + lin + 0.003 if op["hinge"] == "L" else w / 2 - lin - 0.003
    leaf_w = w - 2 * lin - 0.006
    leaf_h = h - lin - 0.012
    dir_u = 1.0 if op["hinge"] == "L" else -1.0
    hinge_v = swing * (t / 2 - 0.01)
    lt = d["leaf"]
    leaf = Parts()
    v0, v1 = (-lt, 0.0) if swing > 0 else (0.0, lt)
    leaf.box(0, v0, 0.01, dir_u * leaf_w, v1, 0.01 + leaf_h, m["door"], bevel=0.003)
    # Lever handles both sides, ~1.0 m high.
    hu = dir_u * (leaf_w - 0.07)
    for side_v, outer in ((v0, v0 - 0.06), (v1, v1 + 0.06)):
        leaf.box(hu - 0.02, side_v, 0.98, hu + 0.02, (side_v + outer) / 2, 1.02, m["metal"], bevel=0.003)
        leaf.box(hu - dir_u * 0.12, (side_v + outer) / 2, 0.99, hu + dir_u * 0.01, outer, 1.01,
                 m["metal"], bevel=0.003)
    hinge = f.world(op["at"] + hinge_u, hinge_v)
    sign = (1.0 if op["hinge"] == "L" else -1.0) * swing
    leaf.to_object(f"Door_{op['id']}_Leaf", coll, (hinge.x, hinge.y, 0),
                   f.rot + sign * op.get("angle", 0))


def build_window(wall, op, m, colls):
    """Fixed frame + mullions; one Pane_* mesh per glass pane (they shatter in The End)."""
    wd = APT["window"]
    f = WallFrame(wall)
    t, w = f.thickness, op["width"]
    sill, head = op["sill"], op["head"]
    fr, mu, depth, gl = wd["frame"], wd["mullion"], wd["depth"], wd["glass"]
    coll = colls[op["room"]]
    centre = f.world(op["at"], 0.0)
    ins = f.interior_side()
    v_mid = -ins * 0.03  # frame sits slightly toward the outside face
    v0, v1 = v_mid - depth / 2, v_mid + depth / 2
    frame = Parts()
    # Reveal lining (plaster return) is the wall itself; add the frame ring.
    frame.box(-w / 2, v0, sill, -w / 2 + fr, v1, head, m["frame"], bevel=0.003)
    frame.box(w / 2 - fr, v0, sill, w / 2, v1, head, m["frame"], bevel=0.003)
    frame.box(-w / 2, v0, sill, w / 2, v1, sill + fr, m["frame"], bevel=0.003)
    frame.box(-w / 2, v0, head - fr, w / 2, v1, head, m["frame"], bevel=0.003)
    cols = op.get("cols", 1)
    inner = w - 2 * fr
    pane_w = (inner - (cols - 1) * mu) / cols
    for i in range(1, cols):
        u = -w / 2 + fr + i * pane_w + (i - 1) * mu
        frame.box(u, v0 + 0.005, sill + fr, u + mu, v1 - 0.005, head - fr, m["frame"], bevel=0.003)
    # Interior sill board and exterior drip sill.
    frame.box(-w / 2 - 0.04, ins * (t / 2 + 0.035), sill - 0.025, w / 2 + 0.04, v_mid, sill,
              m["trim"], bevel=0.004)
    frame.box(-w / 2 - 0.02, -ins * (t / 2 + 0.04), sill - 0.04, w / 2 + 0.02, v_mid, sill - 0.005,
              m["metal"], bevel=0.003)
    frame.to_object(f"Window_{op['id']}_Frame", coll, (centre.x, centre.y, 0), f.rot)
    for i in range(cols):
        u0 = -w / 2 + fr + i * (pane_w + mu)
        pane = Parts().box(u0 - 0.01, v_mid - gl / 2, sill + fr - 0.01, u0 + pane_w + 0.01,
                           v_mid + gl / 2, head - fr + 0.01, m["glass"], bevel=0)
        pane.to_object(f"Pane_{op['id']}_{i + 1}", coll, (centre.x, centre.y, 0), f.rot)


def build_slider(wall, op, m, colls):
    """Two-leaf sliding glass door: outer frame + two sliding leaves on offset tracks."""
    wd = APT["window"]
    f = WallFrame(wall)
    w, sill, head = op["width"], op["sill"], op["head"]
    fr, gl = wd["frame"], wd["glass"]
    coll = colls[op["room"]]
    centre = f.world(op["at"], 0.0)
    ins = f.interior_side()
    depth = 0.12
    frame = Parts()
    frame.box(-w / 2, -depth / 2, sill, -w / 2 + fr, depth / 2, head, m["frame"], bevel=0.003)
    frame.box(w / 2 - fr, -depth / 2, sill, w / 2, depth / 2, head, m["frame"], bevel=0.003)
    frame.box(-w / 2, -depth / 2, head - fr, w / 2, depth / 2, head, m["frame"], bevel=0.003)
    frame.box(-w / 2, -depth / 2, sill, w / 2, depth / 2, sill + 0.02, m["frame"], bevel=0.003)  # track
    frame.to_object(f"Door_{op['id']}_Frame", coll, (centre.x, centre.y, 0), f.rot)
    inner = w - 2 * fr
    leaf_w = inner / 2 + 0.03
    lf = 0.055  # leaf stile/rail width
    for i, (side, track) in enumerate(((-1, ins * 0.03), (1, -ins * 0.03))):
        u0 = -inner / 2 if side < 0 else inner / 2 - leaf_w
        u1 = u0 + leaf_w
        z0, z1 = sill + 0.02, head - fr
        leaf = Parts()
        leaf.box(u0, track - 0.022, z0, u0 + lf, track + 0.022, z1, m["frame"], bevel=0.003)
        leaf.box(u1 - lf, track - 0.022, z0, u1, track + 0.022, z1, m["frame"], bevel=0.003)
        leaf.box(u0, track - 0.022, z0, u1, track + 0.022, z0 + 0.08, m["frame"], bevel=0.003)
        leaf.box(u0, track - 0.022, z1 - lf, u1, track + 0.022, z1, m["frame"], bevel=0.003)
        # Pull handle on the meeting stile.
        hu = u1 - lf / 2 if side < 0 else u0 + lf / 2
        leaf.box(hu - 0.012, track + ins * 0.022, 0.95, hu + 0.012, track + ins * 0.05, 1.25,
                 m["metal"], bevel=0.004)
        name = "A" if i == 0 else "B"
        leaf.to_object(f"Door_{op['id']}_Leaf{name}", coll, (centre.x, centre.y, 0), f.rot)
        pane = Parts().box(u0 + lf - 0.01, track - gl / 2, z0 + 0.07, u1 - lf + 0.01, track + gl / 2,
                           z1 - lf + 0.01, m["glass"], bevel=0)
        pane.to_object(f"Pane_{op['id']}_{i + 1}", coll, (centre.x, centre.y, 0), f.rot)


def build_openings(m, colls):
    for wall in APT["walls"]:
        for op in wall["openings"]:
            {"door": build_door, "window": build_window, "slider": build_slider}[op["type"]](
                wall, op, m, colls)


def build_skirting(m, colls):
    """Walk every long wall face in 1 cm steps; keep stretches that face the interior,
    are not buried in another wall and are not inside a door opening. One mesh per room."""
    sk = APT["skirting"]
    step = 0.01
    boxes = [w["box"] for w in APT["walls"]]
    per_room = {}
    for wall in APT["walls"]:
        f = WallFrame(wall)
        gaps = []
        for op in wall["openings"]:
            if op.get("sill", 0.0) <= 0.0:
                margin = APT["door"]["casing"] + 0.005 if op["type"] == "door" else 0.0
                gaps.append((op["at"] - op["width"] / 2 - margin, op["at"] + op["width"] / 2 + margin))
        u_lo, u_hi = f.u_range
        for side in (-1, 1):
            face_v = side * f.thickness / 2
            samples = []
            n = int(round((u_hi - u_lo) / step))
            for i in range(n + 1):
                u = u_lo + i * step
                q = f.world(u, face_v + side * 0.03)
                ok = (inside(APT["interior"], q.x, q.y)
                      and not any(b[0] < q.x < b[2] and b[1] < q.y < b[3] for b in boxes)
                      and not any(g0 < u < g1 for g0, g1 in gaps))
                samples.append((u, ok))
            run = None
            for u, ok in samples + [(None, False)]:
                if ok and run is None:
                    run = [u, u]
                elif ok:
                    run[1] = u
                elif run is not None:
                    a, b = run
                    run = None
                    if b - a < 0.05:
                        continue
                    # Extend ends that are not at a door so convex corners close up.
                    ext = sk["thickness"] + 0.005
                    a_door = any(abs(a - g1) < 0.03 for _, g1 in gaps)
                    b_door = any(abs(b - g0) < 0.03 for g0, _ in gaps)
                    a2 = a - (0 if a_door else ext)
                    b2 = b + (0 if b_door else ext)
                    p0 = f.world(a2, face_v)
                    p1 = f.world(b2, face_v + side * sk["thickness"])
                    mid = f.world((a + b) / 2, face_v + side * 0.1)
                    room = room_at(mid.x, mid.y)
                    parts = per_room.setdefault(room, Parts())
                    parts.box(min(p0.x, p1.x), min(p0.y, p1.y), 0.0, max(p0.x, p1.x), max(p0.y, p1.y),
                              sk["height"], m["trim"], bevel=0.003)
    for room, parts in per_room.items():
        parts.to_object(f"Skirting_{room}", colls.get(room, colls["Structure"]))


def build_railing(m, colls):
    b = APT["balcony"]
    h = b["rail_height"] - b["drop"]
    z_floor = -b["drop"]
    rail = Parts()
    balusters = Parts()
    for (x0, y0), (x1, y1) in b["rail_runs"]:
        along_x = abs(x1 - x0) > abs(y1 - y0)
        length = abs(x1 - x0) if along_x else abs(y1 - y0)

        def at(s, x0=x0, y0=y0, x1=x1, y1=y1, length=length):
            k = s / length
            return x0 + (x1 - x0) * k, y0 + (y1 - y0) * k

        def bar(s0, s1, half, z0, z1, parts, bevel):
            ax, ay = at(s0)
            bx, by = at(s1)
            if along_x:
                parts.box(ax, ay - half, z0, bx, by + half, z1, m["metal"], bevel=bevel)
            else:
                parts.box(ax - half, ay, z0, bx + half, by, z1, m["metal"], bevel=bevel)

        bar(-0.03, length + 0.03, 0.03, z_floor + h - 0.045, z_floor + h, rail, 0.008)  # handrail
        bar(0, length, 0.02, z_floor + 0.08, z_floor + 0.12, rail, 0.004)  # bottom rail
        n_posts = max(2, int(length / 1.5) + 1)
        for i in range(n_posts):
            s = i * (length - 0.05) / (n_posts - 1) + 0.025
            bar(s - 0.025, s + 0.025, 0.025, z_floor, z_floor + h - 0.045, rail, 0.004)
        n = int(length / 0.12)
        for i in range(1, n):
            s = i * length / n
            bar(s - 0.01, s + 0.01, 0.01, z_floor + 0.12, z_floor + h - 0.045, balusters, 0)
    rail.to_object("Balcony_Railing", colls["Balcony"])
    balusters.to_object("Balcony_Railing_Balusters", colls["Balcony"])


def build_plates(m, colls):
    counts = {}
    for kind, room, x, y, z, facing in APT["plates"]:
        sizes = {"Switch": (0.08, 0.12), "Outlet": (0.08, 0.12), "Thermostat": (0.1, 0.08)}
        w, h = sizes[kind]
        t = 0.012 if kind != "Thermostat" else 0.025
        p = Parts()
        p.box(-w / 2, -t, -h / 2, w / 2, 0, h / 2, m["trim"], bevel=0.003)
        if kind == "Switch":
            p.box(-0.02, -t - 0.006, -0.03, 0.02, -t + 0.001, 0.03, m["trim"], bevel=0.002)
        elif kind == "Outlet":
            for dz in (-0.028, 0.028):
                p.cyl(0, dz, -t - 0.003, -t + 0.001, 0.018, m["dark"], axis="Y", segments=20)
        rot = {"+y": 180, "-y": 0, "+x": 90, "-x": -90}[facing]
        counts[kind] = counts.get(kind, 0) + 1
        name = f"Fixture_{kind}_{room}_{counts[kind]}" if kind != "Thermostat" else "Fixture_Thermostat"
        p.to_object(name, colls[room], (x, y, z), rot)


def build_ceiling_lights(m, colls):
    ceil_z = APT["ceiling"]
    for room, (x, y) in APT["ceiling_lights"].items():
        p = Parts()
        p.cyl(0, 0, -0.012, 0, 0.06, m["trim"], segments=24)
        p.cyl(0, 0, -0.075, -0.012, 0.17, m["trim"], r_top=0.15, segments=40)  # drum shade
        p.cyl(0, 0, -0.08, -0.075, 0.15, m["diffuser"], segments=40)
        p.to_object(f"Fixture_CeilingLight_{room}", colls[room], (x, y, ceil_z), 0)
        light = bpy.data.lights.new(f"Light_{room}", "POINT")
        light.energy = 35.0
        light.shadow_soft_size = 0.12
        light.color = (1.0, 0.96, 0.9)
        obj = bpy.data.objects.new(f"Light_{room}", light)
        obj.location = (x, y, ceil_z - 0.14)
        colls[room].objects.link(obj)


# ---- furniture -----------------------------------------------------------------------
def furn(kind, size, m):
    """Returns Parts in local space: centred on X/Y, z from 0 up; front faces -Y."""
    w, d, h = size
    p = Parts()
    hw, hd = w / 2, d / 2
    wood, soft, dark, white = m["furn"], m["fabric"], m["dark"], m["white"]
    if kind == "desk":
        p.box(-hw, -hd, h - 0.03, hw, hd, h, wood, bevel=0.004)
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box(sx * hw - sx * 0.07, sy * hd - sy * 0.05, 0, sx * hw - sx * 0.03,
                      sy * hd - sy * 0.01, h - 0.03, dark, bevel=0.003)
        p.box(-hw + 0.07, hd - 0.06, h - 0.13, hw - 0.07, hd - 0.04, h - 0.03, dark, bevel=0.003)
    elif kind == "laptop":
        p.box(-hw, -hd, 0, hw, hd, 0.016, m["metal"], bevel=0.003)
        lid = Parts()
        lid.box(-hw, 0, 0, hw, 0.007, 0.21, m["metal"], bevel=0.002)
        lid_mesh = lid.bm
        bmesh.ops.rotate(lid_mesh, verts=lid_mesh.verts[:], cent=(0, 0, 0),
                         matrix=Matrix.Rotation(math.radians(-18), 3, "X"))
        bmesh.ops.translate(lid_mesh, verts=lid_mesh.verts[:], vec=(0, hd - 0.006, 0.014))
        merge_bm(p, lid, m["metal"])
    elif kind == "desk_lamp":
        p.cyl(0, 0, 0, 0.02, 0.07, dark)
        p.cyl(0, 0, 0.02, h - 0.08, 0.008, dark, segments=12)
        p.cyl(0, 0.04, h - 0.1, h - 0.02, 0.06, dark, r_top=0.03)
    elif kind == "clock":
        p.cyl(0, 0.15 - 0.15, -hd, hd, w / 2, white, axis="Y", segments=48)
    elif kind == "round_table":
        p.cyl(0, 0, h - 0.03, h, w / 2, wood, segments=64)
        p.cyl(0, 0, 0.0, h - 0.03, 0.04, dark, segments=20)
        p.cyl(0, 0, 0.0, 0.025, 0.25, dark, segments=40)
    elif kind == "chair":
        p.box(-hw, -hd, 0.43, hw, hd, 0.47, wood, bevel=0.006)
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box(sx * (hw - 0.04) - 0.015, sy * (hd - 0.04) - 0.015, 0, sx * (hw - 0.04) + 0.015,
                      sy * (hd - 0.04) + 0.015, 0.43, wood, bevel=0.004)
        p.box(-hw, hd - 0.04, 0.47, hw, hd, h, wood, bevel=0.006)
    elif kind == "bed":
        # local: width along X, length along Y; head at +Y.
        p.box(-hw, -hd, 0.0, hw, hd - 0.05, 0.3, wood, bevel=0.01)          # base
        p.box(-hw + 0.02, -hd + 0.02, 0.3, hw - 0.02, hd - 0.07, 0.5, white, bevel=0.03)  # mattress
        p.box(-hw + 0.04, -hd + 0.04, 0.48, hw - 0.04, hd - 0.55, 0.55, soft, bevel=0.03)  # duvet
        for sx in (-1, 1):
            p.box(sx * 0.33 - 0.28, hd - 0.5, 0.5, sx * 0.33 + 0.28, hd - 0.12, 0.62, white, bevel=0.04)
        p.box(-hw, hd - 0.05, 0.0, hw, hd, 0.95, wood, bevel=0.01)          # headboard
    elif kind == "bean_bag":
        p.sphere(0, 0, 0.28, w / 2, soft, scale=(1, 1, 0.66))
    elif kind == "floor_lamp":
        p.cyl(0, 0, 0, 0.03, 0.15, dark, segments=40)
        p.cyl(0, 0, 0.03, h - 0.3, 0.012, dark, segments=12)
        p.cyl(0, 0, h - 0.32, h, 0.17, white, r_top=0.13, segments=40)
    elif kind in ("drawer", "drawer_books"):
        p.box(-hw, -hd, 0.06, hw, hd, h, wood, bevel=0.006)
        n = 3 if h > 0.7 else 2
        gap = (h - 0.08) / n
        for i in range(n):
            z0 = 0.08 + i * gap
            p.box(-hw + 0.02, -hd - 0.012, z0 + 0.01, hw - 0.02, -hd, z0 + gap - 0.01, wood, bevel=0.004)
            p.box(-0.06, -hd - 0.03, z0 + gap / 2 - 0.01, 0.06, -hd - 0.012, z0 + gap / 2 + 0.01,
                  m["metal"], bevel=0.003)
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box(sx * hw - sx * 0.05, sy * hd - sy * 0.05, 0, sx * hw - sx * 0.02,
                      sy * hd - sy * 0.02, 0.06, dark, bevel=0.003)
        if kind == "drawer_books":
            x = -hw + 0.04
            for i, (bw, bh) in enumerate(((0.03, 0.24), (0.045, 0.21), (0.025, 0.25), (0.04, 0.2),
                                          (0.035, 0.23), (0.05, 0.19), (0.03, 0.22))):
                p.box(x, -0.08, h, x + bw, 0.1, h + bh, white if i % 2 else soft, bevel=0.003)
                x += bw + 0.004
            p.box(hw - 0.3, -0.12, h, hw - 0.06, 0.1, h + 0.12, soft, bevel=0.003)  # lying stack
    elif kind == "shoe_rack":
        for z in (0.0, 0.2, 0.4):
            p.box(-hw, -hd, z, hw, hd, z + 0.02, wood, bevel=0.003)
        for sx in (-1, 1):
            p.box(sx * hw - sx * 0.02, -hd, 0, sx * hw, hd, h, wood, bevel=0.003)
        for i, sx in enumerate((-0.25, 0.05, 0.25)):
            p.box(sx - 0.05, -hd + 0.02, 0.02, sx + 0.05, hd - 0.02, 0.1, dark, bevel=0.02)
    elif kind == "counter":
        p.box(-hw, -hd + 0.03, 0.1, hw, hd, h - 0.03, wood, bevel=0.004)
        p.box(-hw, -hd + 0.06, 0.0, hw, hd, 0.1, dark, bevel=0.002)  # toe kick
        p.box(-hw, -hd, h - 0.03, hw, hd, h, m["stone"], bevel=0.004)
        n = max(1, round(w / 0.6))
        for i in range(1, n):
            x = -hw + i * w / n
            p.box(x - 0.002, -hd + 0.025, 0.12, x + 0.002, -hd + 0.031, h - 0.05, dark, bevel=0)
    elif kind == "tall_cabinet":
        p.box(-hw, -hd + 0.03, 0.1, hw, hd, h, wood, bevel=0.004)
        p.box(-hw, -hd + 0.06, 0.0, hw, hd, 0.1, dark, bevel=0.002)
        p.box(-0.002 + 0, -hd + 0.025, 0.12, 0.002, -hd + 0.031, h - 0.02, dark, bevel=0)
    elif kind == "upper_cabinets":
        p.box(-hw, -hd, 0, hw, hd, h, wood, bevel=0.004)
        n = max(1, round(w / 0.5))
        for i in range(1, n):
            x = -hw + i * w / n
            p.box(x - 0.002, -hd - 0.004, 0.02, x + 0.002, -hd + 0.001, h - 0.02, dark, bevel=0)
    elif kind == "sink":
        p.box(-hw, -hd, -0.005, hw, hd, 0.004, m["metal"], bevel=0.003)
        p.box(-hw + 0.04, -hd + 0.04, -0.004, hw - 0.04, hd - 0.04, 0.006, m["dark"], bevel=0.01)
        p.cyl(0, hd - 0.03, 0.0, 0.3, 0.015, m["metal"], segments=16)
        p.box(-0.012, hd - 0.2, 0.27, 0.012, hd - 0.02, 0.3, m["metal"], bevel=0.004)
    elif kind == "cooktop":
        p.box(-hw, -hd, -0.005, hw, hd, 0.006, dark, bevel=0.003)
        for cx, cy, r in ((-0.15, -0.12, 0.09), (0.15, -0.12, 0.07), (-0.15, 0.12, 0.07), (0.15, 0.12, 0.09)):
            p.cyl(cx, cy, 0.006, 0.008, r, m["metal"], segments=32)
    elif kind == "fridge":
        p.box(-hw, -hd, 0.02, hw, hd, h, white, bevel=0.012)
        p.box(-hw + 0.005, -hd - 0.004, h * 0.62, hw - 0.005, -hd + 0.002, h * 0.625, dark, bevel=0)
        p.box(hw - 0.08, -hd - 0.04, h * 0.66, hw - 0.06, -hd, h * 0.86, m["metal"], bevel=0.004)
        p.box(hw - 0.08, -hd - 0.04, h * 0.40, hw - 0.06, -hd, h * 0.58, m["metal"], bevel=0.004)
    elif kind == "table_lamp":
        p.cyl(0, 0, 0, 0.22, 0.06, white, r_top=0.035, segments=32)
        p.cyl(0, 0, 0.22, h, w / 2, white, r_top=w / 2 - 0.03, segments=40)
    elif kind == "shower":
        # tray + L glass screen + head on the wall behind (+Y local = wall side)
        p.box(-hw, -hd, 0, hw, hd, 0.05, white, bevel=0.01)
        p.cyl(hw - 0.2, hd - 0.03, 0.05, 1.95, 0.012, m["metal"], segments=12)
        p.cyl(hw - 0.2, hd - 0.12, 1.93, 1.96, 0.1, m["metal"], segments=24)
        p.box(hw - 0.21, hd - 0.12, 1.94, hw - 0.19, hd - 0.03, 1.96, m["metal"], bevel=0.002)
    elif kind == "toilet":
        # local: user faces -Y, cistern at +Y
        p.box(-hw + 0.02, hd - 0.18, 0.4, hw - 0.02, hd, h, white, bevel=0.02)  # cistern
        p.cyl(0, -0.05, 0, 0.38, 0.17, white, r_top=0.19, segments=40)          # bowl
        p.box(-0.12, -0.05, 0.0, 0.12, hd - 0.12, 0.38, white, bevel=0.02)
        p.cyl(0, -0.05, 0.38, 0.41, 0.19, white, segments=40)                   # seat
    elif kind == "vanity":
        p.box(-hw, -hd, 0.15, hw, hd, h - 0.02, wood, bevel=0.005)
        p.box(-hw - 0.01, -hd - 0.01, h - 0.02, hw + 0.01, hd, h, white, bevel=0.006)
        p.box(-0.2, -0.18, h - 0.005, 0.2, 0.12, h + 0.002, m["dark"], bevel=0.01)  # basin hint
        p.cyl(0, hd - 0.06, h, h + 0.2, 0.014, m["metal"], segments=16)
        p.box(-0.3, hd - 0.02, h + 0.25, 0.3, hd, h + 0.95, m["mirror"], bevel=0.004)  # mirror
    elif kind == "tub":
        p.box(-hw, -hd, 0, hw, hd, h, white, bevel=0.02)
        p.box(-hw + 0.08, -hd + 0.08, 0.15, hw - 0.08, hd - 0.08, h + 0.01, m["dark"], bevel=0.04)
    else:  # plain block
        p.box(-hw, -hd, 0, hw, hd, h, m["dark"], bevel=0.006)
    return p


def merge_bm(dst, src, mat):
    """Append src Parts' geometry into dst, mapping material."""
    tmp = bpy.data.meshes.new("_merge")
    src.bm.to_mesh(tmp)
    src.bm.free()
    idx = dst._mat_index(mat)
    for poly in tmp.polygons:
        poly.material_index = idx
    dst.bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)


def build_office_chair_base(m):
    """Five-star base built separately (bmesh rotation per leg)."""
    bm = bmesh.new()
    for i in range(5):
        a = math.radians(90 + i * 72)
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0, 0.15, 0.055))
                                    @ Matrix.Diagonal((0.04, 0.3, 0.03, 1)))
        bmesh.ops.rotate(bm, verts=res["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Z"))
        tip = Matrix.Rotation(a, 3, "Z") @ Vector((0, 0.28, 0))
        bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.025, radius2=0.025, depth=0.04,
                              matrix=Matrix.Translation((tip.x, tip.y, 0.02)))
    return bm


def build_furniture(m, colls):
    for item, room, kind, size, pos, rot in APT["furniture"]:
        if kind == "office_chair":
            p = furn_office_chair(size, m)
        else:
            p = furn(kind, size, m)
        p.to_object(f"Furn_{item}", colls[room], pos, rot)
        if kind == "shower":
            screen = Parts()
            w, d, _ = size
            # glass: one panel along the open front (-Y local) and a return on the +X side
            screen.box(-w / 2 + 0.25, -d / 2, 0.05, w / 2, -d / 2 + 0.008, 2.0, m["glass"], bevel=0)
            screen.box(w / 2 - 0.008, -d / 2, 0.05, w / 2, -d / 2 + 0.6, 2.0, m["glass"], bevel=0)
            screen.to_object(f"Furn_{item}_Screen", colls[room], pos, rot)


def furn_office_chair(size, m):
    w, d, h = size
    dark, soft = m["dark"], m["fabric"]
    p = Parts()
    tmp = bpy.data.meshes.new("_base")
    base = build_office_chair_base(m)
    base.to_mesh(tmp)
    base.free()
    idx = p._mat_index(dark)
    for poly in tmp.polygons:
        poly.material_index = idx
    p.bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    p.cyl(0, 0, 0.07, 0.42, 0.025, dark)
    p.box(-0.25, -0.24, 0.42, 0.25, 0.24, 0.5, soft, bevel=0.025)       # seat
    p.box(-0.23, 0.2, 0.55, 0.23, 0.27, h, soft, bevel=0.025)           # back
    p.box(-0.04, 0.2, 0.45, 0.04, 0.24, 0.6, dark, bevel=0.005)         # spine
    for sx in (-1, 1):
        p.box(sx * 0.27 - 0.02, -0.15, 0.64, sx * 0.27 + 0.02, 0.15, 0.67, dark, bevel=0.008)
        p.box(sx * 0.27 - 0.01, 0.0, 0.5, sx * 0.27 + 0.01, 0.04, 0.64, dark, bevel=0.004)
    return p


# --------------------------------------------------------------------------------------
# cameras, light, world
# --------------------------------------------------------------------------------------
def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_cameras(colls):
    fx, fy = APT["footprint"]
    cams = {}
    # Plan: orthographic, clipped at 1.45 m so it reads as an architectural cut.
    plan = bpy.data.cameras.new("Cam_Plan")
    plan.type = "ORTHO"
    plan.ortho_scale = fx + 0.8
    plan.clip_start = 20.0 - 1.45
    plan.clip_end = 40.0
    obj = bpy.data.objects.new("Cam_Plan", plan)
    obj.location = (fx / 2, fy / 2, 20.0)
    colls["Cameras"].objects.link(obj)
    cams["plan"] = obj
    # Wide: eye level just inside the main door, looking north to the balcony door.
    wide = bpy.data.cameras.new("Cam_Wide")
    wide.lens = 16
    wide.clip_start = 0.05
    obj = bpy.data.objects.new("Cam_Wide", wide)
    obj.location = (4.95, 0.55, 1.6)
    look_at(obj, (4.15, 5.3, 1.15))
    colls["Cameras"].objects.link(obj)
    cams["wide"] = obj
    # Desk 3/4: from the hall, west of the desk; Ivan's chair in profile-3/4, the east window behind.
    desk = bpy.data.cameras.new("Cam_Desk")
    desk.lens = 24
    desk.clip_start = 0.05
    desk.dof.use_dof = False
    obj = bpy.data.objects.new("Cam_Desk", desk)
    obj.location = (5.25, 2.55, 1.45)
    look_at(obj, (7.6, 3.55, 0.95))
    colls["Cameras"].objects.link(obj)
    cams["desk"] = obj
    return cams


def build_world_and_sun(colls):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Grey Sky")
    world.color = (0.42, 0.45, 0.5)
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    if world.node_tree:
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs["Color"].default_value = (*world.color, 1.0)
            bg.inputs["Strength"].default_value = 1.0
    scene.world = world
    s = APT["sun"]
    az, el = math.radians(s["azimuth"]), math.radians(s["elevation"])
    to_sun = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
    sun = bpy.data.lights.new("Sun_East", "SUN")
    sun.energy = s["strength"]
    sun.angle = math.radians(0.6)
    sun.color = (1.0, 0.97, 0.92)
    obj = bpy.data.objects.new("Sun_East", sun)
    obj.location = (14.0, 3.0, 4.0)
    obj.rotation_euler = to_sun.to_track_quat("Z", "Y").to_euler()
    colls["Lights"].objects.link(obj)


# --------------------------------------------------------------------------------------
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    three_blender.register()
    scene = bpy.context.scene

    m = {
        "plaster": material("Plaster", 0.72, 0.9),
        "ceiling": material("Ceiling", 0.78, 0.92),
        "floor": material("Floor", 0.42, 0.55),
        "concrete": material("Concrete", 0.5, 0.85),
        "trim": material("Trim", 0.82, 0.5),
        "door": material("Door", 0.74, 0.45),
        "frame": material("Window Frame", 0.3, 0.45),
        "metal": material("Metal", 0.55, 0.35, metallic=1.0),
        "glass": material("Glass", 0.95, 0.02, transmission=1.0, ior=1.5),
        "mirror": material("Mirror", 0.9, 0.03, metallic=1.0),
        "diffuser": material("Diffuser", 0.95, 0.4),
        "furn": material("Furniture", 0.55, 0.6),
        "fabric": material("Fabric", 0.4, 0.95),
        "dark": material("Dark", 0.12, 0.5),
        "white": material("White", 0.85, 0.45),
        "stone": material("Stone", 0.35, 0.3),
    }

    colls = {}
    for name in ["Structure", *APT["rooms"].keys(), "Lights", "Cameras"]:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        colls[name] = c

    build_slabs(m, colls)
    build_walls(m, colls)
    build_openings(m, colls)
    build_skirting(m, colls)
    build_railing(m, colls)
    build_plates(m, colls)
    build_ceiling_lights(m, colls)
    build_furniture(m, colls)
    cams = build_cameras(colls)
    build_world_and_sun(colls)

    scene.camera = cams["wide"]
    scene.unit_settings.system = "METRIC"
    scene.view_settings.view_transform = "AgX"
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.threejs_use_postprocessing = False
    return scene, cams


def render_stills(scene, cams, out_dir, samples=48):
    out_dir.mkdir(parents=True, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.exposure = 0.0
    above_cut = [o for o in scene.objects
                 if o.name in ("Ceiling", "Balcony_Soffit") or o.name.startswith("Fixture_CeilingLight")]
    jobs = (
        ("plan", (960, 760), 0.6),
        ("wide", (960, 540), 0.8),
        ("desk", (960, 540), 0.8),
    )
    paths = []
    for key, (rx, ry), exposure in jobs:
        scene.camera = cams[key]
        scene.render.resolution_x, scene.render.resolution_y = rx, ry
        scene.view_settings.exposure = exposure
        for o in above_cut:
            o.hide_render = key == "plan"
        scene.render.filepath = str(out_dir / f"shell_{key}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    for o in above_cut:
        o.hide_render = False
    scene.camera = cams["wide"]
    return paths


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    scene, cams = build()
    if "--blend" in args:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "apartment_shell.blend"))
    if "--no-export" not in args:
        print("exported", SceneExporter(str(out / "index.html"), scene=scene).run())
    if "--render" in args:
        print("rendered", render_stills(scene, cams, Path(args[args.index("--render") + 1]).resolve()))
