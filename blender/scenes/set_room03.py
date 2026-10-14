"""Ivan's room: the set for the new scene 1 (scenes/03-ivan-room/PLAN.md, ref/plan_topdown.jpg).

    blender -b --factory-startup -P blender/scenes/set_room03.py -- OUT_DIR [--cams top,door] [--res 1376x768] [--blend]
    blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/room --export
    blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/room --bake [--small] [--samples 64]
    blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/lighting/day --bake --preset day --lm-only

Without --export/--bake it renders Workbench layout frames (fast, to hold against the references); --export writes
the unlit engine set (room.glb + lights.json); --bake adds the 3 AM rig and Cycles lightmaps (GPU). The Studio reloads.

Axes (chosen so the old desk acting works unchanged: Ivan faces +y at the desk, as in the flat):
  x = 0 at the window wall (west, the top of the top-down ref) -> 4.0 at the door wall (east)
  y = 0 at the bed-head wall (south, the left of the ref)       -> 4.8 at the desk wall (north, the right of the ref)
The desk props of the old intro are built where they were and moved by OFF, so Ivan's performance moves by OFF too.
"""
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import geo  # noqa: E402
import materials as M  # noqa: E402

ROOT = HERE.parents[1]
PROPS = ROOT / "blender" / "assets" / "props"
TEX = ROOT / "blender" / "assets" / "textures"

W, D, H = 4.0, 4.8, 2.7            # room interior (x, y, z)
T_EXT, T_IN = 0.30, 0.12           # window wall / other walls
WIN_Y0, WIN_Y1, SILL, HEAD = 0.95, 3.75, 0.86, 2.42
UNITS = 3
DOOR_Y0, DOOR_Y1 = 1.05, 1.95      # east wall
OFF = Vector((-5.90, 1.23, 0.0))   # old intro desk zone -> this room (Ivan's chair 6.95,2.60 -> 1.05,3.83)
TOP = 0.75                         # desk top
DESK_LAMP_HEAD = (0.77, 4.56, TOP + 0.60)   # the arm lamp's bulb (desk_lamp_arm_01 at 0.55,4.70 turned 238)
GROUND = -38.0
MOON = (1.0, -0.35, -0.75)          # moonlight direction (travelling): in through the west window, down onto the bed and rug                     # the valley floor below the hill the house sits on

# name: (position, look-at, focal mm, up-hint) ; 'top' is the reference's view straight down, window at the top
SHOTS = {
    "top":  ((1.15, 2.40, 3.0), (1.15, 2.40, 0.0), 20, (-1, 0, 0)),
    "door": ((3.70, 0.45, 1.55), (0.80, 3.70, 0.85), 22, None),
    "desk": ((2.35, 2.75, 1.35), (0.95, 4.55, 0.95), 30, None),
    "bed":  ((3.20, 3.60, 1.60), (0.40, 0.60, 0.70), 24, None),
    "shelf": ((1.60, 3.30, 1.20), (0.20, 4.36, 1.00), 30, None),
}


# ---------------------------------------------------------------------------------------------- materials
def _blur(a, r):
    """Box blur (separable, edge-clamped) on an HxW or HxWxC array: soft wool instead of vector edges."""
    n = 2 * r + 1
    for ax in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[ax] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=ax, dtype=np.float64)
        size = a.shape[ax]
        a = ((np.take(c, np.arange(n, n + size), axis=ax) - np.take(c, np.arange(0, size), axis=ax)) / n).astype(np.float32)
    return a


def rug_texture(path, w=768, h=1280, seed=7):
    """A worn Persian runner: madder-red field with abrash, indigo borders, ivory guards, a floral medallion,
    scattered rosettes, then pile, wear and fringe. Soft like wool, not a vector graphic."""
    if path.exists():
        return path
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = x / w, y / h
    madder, indigo, ivory = np.array([0.40, 0.13, 0.09]), np.array([0.08, 0.10, 0.19]), np.array([0.72, 0.64, 0.50])
    rust, teal, gold = np.array([0.55, 0.25, 0.12]), np.array([0.17, 0.28, 0.29]), np.array([0.62, 0.45, 0.20])
    img = np.ones((h, w, 3), np.float32) * madder
    # abrash: hand-dyed wool batches -> soft horizontal bands of slightly different red
    bands = np.cumsum(rng.normal(0, 1, h)).astype(np.float32)
    bands = _blur((bands - bands.mean())[:, None] / (bands.std() + 1e-6), 12)[:, 0]
    img *= (1 + 0.07 * bands)[:, None, None]
    e = np.minimum(np.minimum(u, 1 - u) * w, np.minimum(v, 1 - v) * h) / 64.0     # distance from the edge
    img[e < 1.6] = indigo
    img[(e > 0.50) & (e < 0.62)] = ivory
    img[(e > 1.34) & (e < 1.46)] = ivory
    band = (e > 0.7) & (e < 1.25)
    t = np.where(np.minimum(u, 1 - u) * w < np.minimum(v, 1 - v) * h, v * h, u * w) / 38.0   # along the border
    vine = band & (np.abs(np.sin(t * np.pi) * 0.25 - (e - 0.97)) < 0.07)
    img[vine] = gold
    buds = band & ((np.sin(t * np.pi * 2) ** 2) * (1 - np.abs(e - 0.97) * 4) > 0.75)
    img[buds] = rust
    inner = e > 1.6
    # field: an offset lattice of rosettes (petals by polar sine) and leaves
    for i, (sx, sy, col, r0) in enumerate(((22, 30, teal, 0.0), (22, 30, ivory, 0.5))):
        cu = (u * sx + r0) % 1 - 0.5
        cv = (v * sy + r0) % 1 - 0.5
        rr = np.sqrt((cu * 1.0) ** 2 + (cv * sx / sy) ** 2)
        th = np.arctan2(cv, cu)
        petal = rr < (0.18 + 0.08 * np.cos(6 * th)) * (0.85 if i else 1.0)
        img[petal & inner] = col
        img[(rr < 0.06) & inner] = gold if i else rust
    # medallion: lobed star, nested
    for cy, sc in ((0.5, 1.0), (0.27, 0.38), (0.73, 0.38)):
        du, dv = (u - 0.5) / (0.25 * sc), (v - cy) / (0.25 * sc * w / h * 1.3)
        rr, th = np.sqrt(du ** 2 + dv ** 2), np.arctan2(dv, du)
        lobe = 1 + 0.18 * np.cos(8 * th) + 0.06 * np.cos(16 * th)
        for lim, col in ((1.0, indigo), (0.84, ivory), (0.78, madder * 1.1), (0.55, teal), (0.42, ivory), (0.30, rust), (0.14, gold)):
            img[(rr < lim * lobe) & inner] = col
    img = _blur(img, 2)                                  # wool, not pixels
    # pile: knot grain + random knots, then wear (a pale path where feet go) and a little dirt
    knot = (0.9 + 0.1 * np.sin(x * 1.9) * np.sin(y * 2.3))[..., None]
    img *= knot * (0.9 + 0.1 * rng.random((h, w, 1))).astype(np.float32)
    wear = np.exp(-((u - 0.40) ** 2) / 0.03 - ((v - 0.55) ** 2) / 0.12) * 0.40
    wear = wear * (0.6 + 0.4 * _blur(rng.random((h, w)).astype(np.float32), 6))
    img = img * (1 - wear[..., None]) + np.array([0.42, 0.34, 0.28]) * wear[..., None]
    dirt = _blur(rng.random((h, w)).astype(np.float32), 40)
    img *= (0.88 + 0.24 * (dirt - dirt.mean()))[..., None]
    # fringe at both short ends
    fr = (np.minimum(v, 1 - v) * h < 18) & (np.sin(x * 1.6) > -0.2)
    img[fr] = ivory * 0.8
    img[(np.minimum(v, 1 - v) * h < 18) & ~fr] = 0.0
    img = img * 0.85 + img.mean(axis=2, keepdims=True) * 0.15     # sun-faded
    out = np.concatenate([np.clip(img, 0, 1), np.ones((h, w, 1), np.float32)], axis=2)[::-1]
    im = bpy.data.images.new("rug_persian", w, h)
    im.pixels.foreach_set(np.ascontiguousarray(out, dtype=np.float32).ravel())
    im.filepath_raw, im.file_format = str(path), "PNG"
    im.save()
    return path


def sky_texture(path, w=2048, h=512, seed=3):
    """Night sky for the far card: deep blue, a warm city-glow band at the horizon, soft moonlit clouds."""
    if path.exists():
        return path
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    v = y / h                                       # 0 = horizon (bottom row written first), 1 = top
    top, mid, glow = np.array([0.010, 0.013, 0.040]), np.array([0.075, 0.085, 0.200]), np.array([0.30, 0.20, 0.30])
    img = top + (mid - top) * np.exp(-v * 2.2)[..., None]       # deep navy overhead -> dusky blue-violet low down
    img += glow * np.exp(-v / 0.16)[..., None]                   # the city's glow rising off the horizon
    n = np.zeros((h, w), np.float32)                # clouds: a few octaves of smoothed noise
    for k, s in ((8, 1.0), (16, 0.5), (32, 0.25)):
        g = rng.random((k, k * 4)).astype(np.float32)
        n += s * np.kron(g, np.ones((h // k + 1, w // (k * 4) + 1)))[:h, :w]
    n = _blur(n, 18)
    c = np.clip((n - 1.05) * 2.5, 0, 1) * np.clip(v * 4, 0, 1) * np.clip(1.4 - v, 0, 1)
    img += c[..., None] * np.array([0.05, 0.065, 0.10])
    out = np.concatenate([img, np.ones((h, w, 1), np.float32)], axis=2)
    im = bpy.data.images.new("sky_night", w, h, float_buffer=False)
    im.pixels.foreach_set(np.ascontiguousarray(np.clip(out, 0, 1), dtype=np.float32).ravel())
    im.filepath_raw, im.file_format = str(path), "PNG"
    im.save()
    return path


# Workbench preview colours for the procedural materials (Cycles and the engine use the real shaders)
SHOW = {"wall": (0.07, 0.11, 0.09), "ceil": (0.3, 0.3, 0.3), "floor": (0.22, 0.12, 0.07), "walnut": (0.20, 0.09, 0.05),
        "bedwood": (0.16, 0.08, 0.04), "duvet": (0.06, 0.08, 0.16), "sheet": (0.36, 0.40, 0.46), "pillow": (0.62, 0.60, 0.56),
        "rug_oat": (0.30, 0.26, 0.21), "spruce": (0.6, 0.38, 0.16), "rosewood": (0.12, 0.05, 0.03), "lamp_base": (0.32, 0.22, 0.14),
        "cloth_grey": (0.10, 0.10, 0.12), "cloth_olive": (0.16, 0.16, 0.09), "tree": (0.03, 0.06, 0.03), "trim": (0.62, 0.60, 0.56)}


def mats():
    m = _mats()
    for k, rgb in SHOW.items():
        m[k].diffuse_color = (*rgb, 1)
    return m


def _mats():
    rug = rug_texture(TEX / "rug_persian.png")
    try:
        sky = sky_texture(TEX / "sky_night.png")
    except ImportError:                              # no scipy: a plain gradient card
        sky = None
    return {
        "wall": M.plaster("Wall Green", (0.175, 0.215, 0.180), 0.9),   # light must bounce: deep green, not black
        "ceil": M.plaster("Ceiling", (0.30, 0.31, 0.29), 0.95),
        "floor": M.oak_floor("Floor Dark Oak"),
        "trim": M.paint("Trim", (0.62, 0.60, 0.56), 0.45),
        "glass": M.glass("Glass"),
        "blind": M.paint("Blind Slat", (0.66, 0.64, 0.58), 0.5),
        "walnut": M.walnut("Desk Walnut"),
        "bedwood": M.walnut("Bed Walnut", base=(0.09, 0.045, 0.025), light=(0.20, 0.11, 0.06)),
        "duvet": M.paint("Duvet Navy", (0.050, 0.068, 0.130), 0.95),
        "sheet": M.paint("Sheet Cotton", (0.36, 0.40, 0.46), 0.95),
        "pillow": M.paint("Pillow Linen", (0.62, 0.60, 0.56), 0.95),
        "rug_navy": M.fabric("Rug Navy", (0.035, 0.050, 0.110), 0.98, weave=600.0, sheen=0.3),
        "rug": M.image_mat("Rug Persian", rug, 0.95),
        "shade": M.emission("Lamp Shade", (1.0, 0.62, 0.30), 10.0),
        "rug_oat": M.paint("Rug Oat", (0.30, 0.26, 0.21), 0.98),
        "lamp_metal": M.paint("Lamp Metal", (0.05, 0.05, 0.05), 0.45),
        "lamp_base": M.ceramic("Lamp Ceramic", (0.32, 0.22, 0.14), 0.3),
        "bulb": M.emission("Lamp_Bulb", (1.0, 0.75, 0.45), 30.0),
        "spruce": M.paint("Guitar Spruce", (0.62, 0.38, 0.16), 0.3, coat=0.8),
        "rosewood": M.paint("Guitar Rosewood", (0.10, 0.045, 0.025), 0.35, coat=0.8),
        "string": M.brushed_metal("Guitar String", (0.8, 0.78, 0.7), 0.2),
        "hole": M.paint("Dark", (0.01, 0.008, 0.006), 0.9),
        "paper": M.paint("Printer Paper", (0.80, 0.79, 0.76), 0.85),
        "print": M.image_mat("Printout", TEX / "printout.png", 0.85),
        "poster": M.image_mat("Poster Print", TEX / "wall_print.png", 0.7),
        "poster_band": M.image_mat("Poster Band", TEX / "poster_band.png", 0.75),
        "poster_dev": M.image_mat("Poster Dev", TEX / "poster_dev.png", 0.75),
        "poster_hello": M.image_mat("Poster Hello", TEX / "poster_hello.png", 0.75),
        "cable_white": M.plastic("Cable", (0.80, 0.80, 0.78), 0.45),
        "poster_film": M.image_mat("Poster Film", TEX / "poster_film.png", 0.75),
        "cork": M.paint("Cork", (0.42, 0.29, 0.17), 0.95),
        "note": M.paint("Note Paper", (0.82, 0.80, 0.74), 0.9),
        "sticky_y": M.paint("Sticky Note Yellow", (0.85, 0.72, 0.20), 0.9),
        "sticky_p": M.paint("Sticky Note Pink", (0.85, 0.42, 0.52), 0.9),
        "printer_orange": M.plastic("Printer Orange", (0.75, 0.22, 0.04), 0.4),
        "console_grey": M.plastic("Console Grey", (0.55, 0.55, 0.53), 0.5),
        "led_blue": M.emission("LED Blue", (0.25, 0.5, 1.0), 6.0),
        "led_green": M.emission("LED Green", (0.25, 1.0, 0.45), 5.0),
        "printer_screen": M.emission("Printer Screen", (1.0, 0.5, 0.15), 2.5),
        "sole": M.plastic("Sole White", (0.78, 0.77, 0.73), 0.7),
        "can_red": M.brushed_metal("Can Red", (0.5, 0.03, 0.02), 0.25),
        "can_silver": M.brushed_metal("Can Silver Blue", (0.25, 0.35, 0.6), 0.25),
        "cloth_grey": M.fabric("Hoodie Grey", (0.09, 0.10, 0.12), 0.95, weave=900.0),
        "cloth_olive": M.fabric("Tee Olive", (0.10, 0.10, 0.06), 0.95),
        "code": M.emission("Code Screen", (1, 1, 1), 2.4, TEX / "monitor_screen.png"),
        "black": M.plastic("Monitor Black", (0.012, 0.012, 0.014), 0.35),
        "house_win": M.emission("House Window LED", (1.0, 0.70, 0.40), 8.0),
        "sky": M.emission("Sky Night", (1, 1, 1), 5.0, sky) if sky else M.emission("Sky Night", (0.02, 0.03, 0.07), 1.0),
        "facade": M.emission("Facade City", (1, 1, 1), 1.0),
        "sodium": M.emission("Sodium Light", (1.0, 0.55, 0.20), 40.0),
        "led_white": M.emission("Street LED", (0.85, 0.9, 1.0), 30.0),
        "aviation": M.emission("Aviation Red", (1.0, 0.08, 0.04), 60.0),
        "tree": M.paint("Leaf Night", (0.015, 0.025, 0.015), 0.8),
        "ground": M.paint("Ground Night", (0.012, 0.012, 0.014), 0.95),
        "roof": M.paint("Roof Night", (0.03, 0.03, 0.035), 0.8),
    }


# ---------------------------------------------------------------------------------------------- helpers
def metric_uv(o):
    """Box projection, 1 UV unit = 1 m (tiling textures keep one density; the engine's facade relies on it)."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    mw = o.matrix_world
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            p = mw @ lp.vert.co
            lp[uv].uv = (p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)
    bm.to_mesh(me)
    bm.free()


LIVE_LIT = ("potted_plant", "fern", "book_", "alarm_clock", "standing_picture")


def glb(file, loc, rot=0.0, scale=1.0, name=None):
    """A model the director supplied (blender/assets/props_src/<file>), handled like a Poly Haven one."""
    return ph(file, loc, rot, scale, name, src=ROOT / "blender" / "assets" / "props_src" / file)


def ph(asset, loc, rot=0.0, scale=1.0, name=None, coll="Props", src=None):
    """A Poly Haven model, joined into one object (its own UVs and textures are kept: keep_uv).
    Leafy and many-part small props stay out of the lightmaps (thousands of tiny islands would starve the
    big surfaces of resolution); the engine lights them live and with the room's reflection capture."""
    f = src or next((PROPS / asset).glob("*.gltf"))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(f))
    new = [o for o in bpy.data.objects if o not in before]
    names = [o.name for o in new]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:                                # bake parent transforms into the meshes
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    for n in names:                                 # empties and nodes the importer made
        x = bpy.data.objects.get(n)
        if x is not None and x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    o.name = name or asset
    for slot in o.material_slots:                   # a second import of the same asset reuses the first one's material
        base = slot.material.name.rsplit(".", 1)[0] if slot.material else None
        if base and base != slot.material.name and bpy.data.materials.get(base):
            dup, slot.material = slot.material, bpy.data.materials[base]
            if not dup.users:
                bpy.data.materials.remove(dup)
    for im in [im for im in bpy.data.images if not im.users]:
        bpy.data.images.remove(im)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    geo.coll(coll).objects.link(o)
    o.location = loc
    o.rotation_mode = "XYZ"                          # the importer leaves quaternions on
    o.rotation_euler = (0, 0, math.radians(rot))
    o.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    o["keep_uv"] = True
    if asset.startswith(LIVE_LIT):
        o["bake_group"] = "PROPS"
    return o


def cloth_drape(o, colliders, frames=45, thickness=0.02, wrinkle=0.0):
    """Drop a cloth plane onto colliders with Blender's cloth sim and keep the settled shape."""
    for cdr in colliders:
        cdr.modifiers.new("Collision", "COLLISION")
        cdr.collision.thickness_outer = 0.006
    cl = o.modifiers.new("Cloth", "CLOTH")
    s = cl.settings
    s.quality, s.mass = 6, 0.4
    s.tension_stiffness = s.compression_stiffness = 12
    s.bending_stiffness = 0.6
    cl.collision_settings.use_self_collision = False
    cl.collision_settings.distance_min = 0.006
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cl.point_cache.frame_end = frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me
    sc.frame_set(1)
    for cdr in colliders:
        for md in [md for md in cdr.modifiers if md.type == "COLLISION"]:
            cdr.modifiers.remove(md)
    if wrinkle:                                     # small creases the sim is too coarse to make
        tex = bpy.data.textures.new(f"{o.name}_creases", "CLOUDS")
        tex.noise_scale, tex.noise_depth = 0.09, 3
        dsp = o.modifiers.new("Creases", "DISPLACE")
        dsp.texture, dsp.strength, dsp.texture_coords = tex, wrinkle, "GLOBAL"
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness, sol.offset = thickness, -1
    geo.subsurf(o, 1)
    return geo.smooth(o, 80)


def drop_faces(o, test):
    """Delete the faces whose world normal passes `test` (faces the camera never sees but the bake would light)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    rot = o.matrix_world.to_3x3()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if test(rot @ f.normal)], context="FACES")
    bm.to_mesh(o.data)
    bm.free()


def grid_plane(name, size, loc, mat, coll, cuts):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=cuts[0], y_segments=cuts[1], size=0.5)
    bmesh.ops.scale(bm, vec=(size[0], size[1], 1), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    o.data.materials.append(mat)
    return o


# ---------------------------------------------------------------------------------------------- shell
def build_shell(m):
    c = geo.coll("Structure")
    box = lambda n, s, l, mm: geo.box(n, s, l, mm, c, bev=0)        # noqa: E731  (centred XY, base at z)
    span_x, span_y = W + T_EXT + T_IN, D + 2 * T_IN
    cx, cy = (W + T_IN - T_EXT) / 2, D / 2
    box("Floor", (span_x, span_y, 0.05), (cx, cy, -0.05), m["floor"])
    box("Ceiling", (span_x, span_y, 0.05), (cx, cy, H), m["ceil"])
    box("Wall_S", (span_x, T_IN, H), (cx, -T_IN / 2, 0), m["wall"])
    box("Wall_N", (span_x, T_IN, H), (cx, D + T_IN / 2, 0), m["wall"])
    # east wall with the door opening
    xE = W + T_IN / 2
    box("Wall_E_a", (T_IN, DOOR_Y0, H), (xE, DOOR_Y0 / 2, 0), m["wall"])
    box("Wall_E_b", (T_IN, D - DOOR_Y1, H), (xE, (D + DOOR_Y1) / 2, 0), m["wall"])
    box("Wall_E_head", (T_IN, DOOR_Y1 - DOOR_Y0, H - 2.1), (xE, (DOOR_Y0 + DOOR_Y1) / 2, 2.1), m["wall"])
    box("Door", (0.04, DOOR_Y1 - DOOR_Y0 - 0.04, 2.08), (W + 0.02, (DOOR_Y0 + DOOR_Y1) / 2, 0), m["trim"])
    for s in (-1, 1):
        box(f"Casing_Door_{s}", (0.02, 0.08, 2.14), (W - 0.01, (DOOR_Y0 + DOOR_Y1) / 2 + s * ((DOOR_Y1 - DOOR_Y0) / 2 + 0.04), 0), m["trim"])
    box("Casing_Door_T", (0.02, DOOR_Y1 - DOOR_Y0 + 0.16, 0.08), (W - 0.01, (DOOR_Y0 + DOOR_Y1) / 2, 2.1), m["trim"])
    # window wall (x = -T_EXT .. 0) around the opening
    xW = -T_EXT / 2
    box("Wall_W_s", (T_EXT, WIN_Y0, H), (xW, WIN_Y0 / 2, 0), m["wall"])
    box("Wall_W_n", (T_EXT, D - WIN_Y1, H), (xW, (D + WIN_Y1) / 2, 0), m["wall"])
    box("Wall_W_sill", (T_EXT, WIN_Y1 - WIN_Y0, SILL), (xW, (WIN_Y0 + WIN_Y1) / 2, 0), m["wall"])
    box("Wall_W_head", (T_EXT, WIN_Y1 - WIN_Y0, H - HEAD), (xW, (WIN_Y0 + WIN_Y1) / 2, HEAD), m["wall"])
    for n in ("Wall_W_s", "Wall_W_n", "Wall_W_sill", "Wall_W_head"):
        drop_faces(bpy.data.objects[n], lambda nrm: nrm.x < -0.9)
    for n, s, l in (("Skirting_W1", (0.015, WIN_Y0, 0.10), (0.0075, WIN_Y0 / 2, 0)),
                    ("Skirting_W2", (0.015, D, 0.10), (0.0075, D / 2, 0)),
                    ("Skirting_S", (W, 0.015, 0.10), (W / 2, 0.0075, 0)),
                    ("Skirting_N", (W, 0.015, 0.10), (W / 2, D - 0.0075, 0))):
        box(n, s, l, m["trim"])
    bpy.data.objects.remove(bpy.data.objects["Skirting_W1"])


def build_window(m):
    """Three double-hung units in a painted frame, casing + deep stool, blinds pulled up (the ref's window)."""
    c = geo.coll("Structure")
    box = lambda n, s, l, mm: geo.box(n, s, l, mm, c, bev=0.002)    # noqa: E731
    cy, wd = (WIN_Y0 + WIN_Y1) / 2, WIN_Y1 - WIN_Y0
    xF = -0.17                                       # frame plane inside the wall depth
    box("Casing_L", (0.02, 0.10, HEAD - SILL + 0.10), (0.01, WIN_Y0 - 0.05, SILL), m["trim"])
    box("Casing_R", (0.02, 0.10, HEAD - SILL + 0.10), (0.01, WIN_Y1 + 0.05, SILL), m["trim"])
    box("Casing_T", (0.02, wd + 0.20, 0.10), (0.01, cy, HEAD), m["trim"])
    box("Window_Stool", (0.26, wd + 0.28, 0.03), (-0.08, cy, SILL - 0.03), m["trim"])
    box("Window_Apron", (0.02, wd + 0.16, 0.09), (0.01, cy, SILL - 0.12), m["trim"])
    box("Lining_L", (T_EXT - 0.02, 0.02, HEAD - SILL), (-T_EXT / 2, WIN_Y0 + 0.01, SILL), m["trim"])
    box("Lining_R", (T_EXT - 0.02, 0.02, HEAD - SILL), (-T_EXT / 2, WIN_Y1 - 0.01, SILL), m["trim"])
    box("Lining_T", (T_EXT - 0.02, wd, 0.02), (-T_EXT / 2, cy, HEAD - 0.02), m["trim"])
    uw = wd / UNITS
    mid = (SILL + HEAD) / 2
    for i in range(UNITS):
        y0 = WIN_Y0 + i * uw
        uy = y0 + uw / 2
        if i:
            box(f"Frame_Mullion_{i}", (0.12, 0.10, HEAD - SILL), (xF, y0, SILL), m["trim"])
        for k, (z0, z1, dx) in enumerate(((SILL + 0.02, mid + 0.02, 0.03), (mid - 0.02, HEAD - 0.02, -0.03))):
            sx, sw, sh = xF + dx, uw - 0.08, z1 - z0
            box(f"Frame_Sash{i}{k}_L", (0.045, 0.05, sh), (sx, y0 + 0.065, z0), m["trim"])
            box(f"Frame_Sash{i}{k}_R", (0.045, 0.05, sh), (sx, y0 + uw - 0.065, z0), m["trim"])
            box(f"Frame_Sash{i}{k}_B", (0.045, sw, 0.06), (sx, uy, z0), m["trim"])
            box(f"Frame_Sash{i}{k}_T", (0.045, sw, 0.05), (sx, uy, z1 - 0.05), m["trim"])
            geo.plane(f"Window_Glass{i}{k}", (sw, sh), (sx - 0.01, uy, z0 + sh / 2), m["glass"], c, rot=(90, 0, 90))
    # blinds pulled up into a stack under the head
    cb = geo.coll("Blinds")
    top = HEAD - 0.03
    geo.box("Blind_HeadRail", (0.05, wd - 0.04, 0.05), (-0.05, cy, top - 0.05), m["blind"], cb, bev=0.004)
    n = 24
    for k in range(n):
        geo.box(f"Blind_Slat_{k:02d}", (0.05, wd - 0.06, 0.003), (-0.05, cy, top - 0.07 - k * 0.0125), m["blind"], cb,
                rot=(0, 8, 0), bev=0)
    geo.box("Blind_BottomRail", (0.05, wd - 0.06, 0.02), (-0.05, cy, top - 0.09 - n * 0.0125), m["blind"], cb, bev=0.003)
    for y in (WIN_Y0 + 0.4, WIN_Y1 - 0.4):
        geo.box("Blind_Cord", (0.004, 0.004, 0.9), (-0.02, y, top - 0.95), m["blind"], cb, bev=0)
    for o in cb.objects:              # lit live: they sit in the window light's hottest spot and the bake burned them white
        o["bake_group"] = "PROPS"


# ---------------------------------------------------------------------------------------------- furniture
def rumpled_duvet(name, cx, hw, v0, v1, top, mat, coll, seed=3):
    """A duvet as one cloth sheet: flat on the mattress with low, soft rumples, rolling over the sides and the foot
    (a quarter circle, then straight down), the head edge turned back into a soft roll, one corner flung open."""
    rng = random.Random(seed)
    waves = [(rng.uniform(4, 9), rng.uniform(3, 8), rng.uniform(0, 6.3), rng.uniform(0.006, 0.014)) for _ in range(5)]
    hang, r, base = 0.24, 0.06, top + 0.035
    q = r * math.pi / 2

    def roll(e):                                     # distance past the edge -> (out, down)
        if e < q:
            return r * math.sin(e / r), r * (1 - math.cos(e / r))
        return r + 0.012 * math.sin(e * 30), r + (e - q)

    nu, nv = 70, 90
    bm = bmesh.new()
    rows = []
    for j in range(nv + 1):
        v = v0 + (v1 - v0 + hang + q) * j / nv
        row = []
        for i in range(nu + 1):
            u = -hw - hang - q + 2 * (hw + hang + q) * i / nu
            x, y, z = u, v, base
            soft = sum(a_ * math.sin(fu * u + fv * v + ph_) for fu, fv, ph_, a_ in waves)
            ex, ey = max(0.0, abs(u) - hw), max(0.0, v - v1)
            if ex > 0:
                o, d = roll(ex)
                x = math.copysign(hw + o, u)
                z -= d
            if ey > 0:
                o, d = roll(ey)
                y = v1 + o
                z -= d
            if ex > 0 or ey > 0:                          # hanging cloth folds vertically
                k = min(1.0, (ex + ey) / 0.08)
                if ex > 0:
                    x += math.copysign(0.018 * k * math.sin(v * 13 + 1.7), u)
                if ey > 0:
                    y += 0.018 * k * math.sin(u * 13 + 0.4)
            z += soft * (1.0 if ex == 0 and ey == 0 else 0.4)
            dv = v - v0                                   # the head edge turned back: a soft roll along the top
            z += 0.045 * math.exp(-((dv - 0.07) / 0.06) ** 2)
            cu, cv = (u - (hw - 0.35)) / 0.35, dv / 0.45  # the room-side head corner thrown open
            if cu > 0 and cv < 1 and ex == 0:
                z += 0.05 * min(1.0, cu) * (1 - cv)
            row.append(bm.verts.new((cx + x, y, z)))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.data.materials.append(mat)
    sol = o.modifiers.new("Thick", "SOLIDIFY")
    sol.thickness = 0.03
    sol.offset = -1
    geo.subsurf(o, 1)
    geo.smooth(o, 80)
    return o


def build_bed(m):
    """Queen bed, head on the south wall: a low walnut platform with a headboard, the mattress fitted inside it,
    a flat fitted sheet, a navy duvet folded back over the foot third, two plump pillows. Clean, rounded shapes in
    flat colours (the references' softness comes from shape and light, not from noise)."""
    c = geo.coll("Bed")
    x0, x1, y0, y1 = 0.48, 2.10, 0.04, 2.16          # frame footprint (1.62 x 2.12)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 0.03
    wood = m["bedwood"]
    geo.box("Bed_Headboard", (x1 - x0 + 0.04, 0.07, 0.95), (cx, y0 + 0.035, 0.0), wood, c, bev=0.012)
    geo.box("Bed_Frame", (x1 - x0, y1 - y0 - 0.07, 0.20), (cx, cy, 0.08), wood, c, bev=0.012)   # the platform's sides
    for sx in (x0 + 0.06, x1 - 0.06):
        for sy in (y0 + 0.12, y1 - 0.06):
            geo.box(f"Bed_Leg_{sx:.1f}_{sy:.1f}", (0.06, 0.06, 0.08), (sx, sy, 0.0), wood, c, bev=0.006)
    mw, md = x1 - x0 - 0.04, y1 - y0 - 0.11          # the mattress sits inside the frame, 2 cm proud on each side
    sheet = geo.rounded_slab("Bed_Mattress", (mw, md, 0.24), 0.07, (cx, cy, 0.24), m["sheet"], c)
    geo.subsurf(sheet, 1)
    geo.smooth(sheet, 80)
    # duvet: slept in and pushed back. A rumpled sheet over the lower two thirds, hanging over the sides and the foot,
    # its top edge turned back, one corner thrown open toward the room (look_target, the ref's soft quilt folds)
    rumpled_duvet("Bed_Duvet", cx, mw / 2 + 0.03, y0 + 0.78, y1 + 0.01, 0.48, m["duvet"], c)
    for i, px in enumerate((cx - 0.38, cx + 0.38)):
        p = geo.rounded_slab(f"Bed_Pillow_{i}", (0.66, 0.42, 0.13), 0.065, (px, y0 + 0.36, 0.47), m["pillow"], c,
                             rot=(8, 0, 3 if i else -2))
        geo.subsurf(p, 2)
        geo.smooth(p, 80)
    return c


def build_lamp(m, base):
    """Table lamp on the nightstand: ceramic gourd base, tapered fabric shade glowing amber, a bulb inside."""
    c = geo.coll("Props")
    x, y, z = base
    prof = [(0.0, 0.0), (0.06, 0.0), (0.075, 0.03), (0.085, 0.09), (0.07, 0.17), (0.035, 0.22), (0.02, 0.27),
            (0.02, 0.33), (0.0, 0.33)]
    geo.lathe("Lamp_Base", prof, (x, y, z), m["lamp_base"], c)
    geo.cyl("Lamp_Shade", 0.17, 0.24, (x, y, z + 0.30), m["shade"], c, r_top=0.115, cap=False, seg=64)
    geo.cyl("Lamp_Bulb", 0.03, 0.06, (x, y, z + 0.36), m["bulb"], c, seg=24)
    return Vector((x, y, z + 0.40))


def build_guitar(m, foot, lean_deg=14.0, rot=90.0):
    """Acoustic dreadnought leaning on the window wall below the sill (one guitar, as asked)."""
    c = geo.coll("Props")
    # outline: union of the lower and upper bouts (circles), traced by rays from a point inside both
    cx_, cz_ = 0.0, 0.36
    pts = []
    for k in range(120):
        a = 2 * math.pi * k / 120
        dx, dz = math.cos(a), math.sin(a)
        r = 0.0
        for oz, R in ((0.21, 0.20), (0.50, 0.15)):
            bx, bz = cx_ - 0.0, cz_ - oz
            b_ = dx * bx + dz * bz
            r = max(r, -b_ + math.sqrt(b_ * b_ - (bx * bx + bz * bz - R * R)))
        pts.append((cx_ + r * dx, cz_ + r * dz))
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0.0, z)) for x, z in pts]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)], vec=(0, 0.10, 0))
    me = bpy.data.meshes.new("Guitar_Body")
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new("Guitar_Body", me)
    c.objects.link(body)
    body.data.materials.append(m["spruce"])
    body.data.materials.append(m["rosewood"])
    for p in body.data.polygons:                     # top/back spruce, sides rosewood
        p.material_index = 0 if abs(p.normal.y) > 0.9 else 1
    geo.bevel(body, 0.006, 2)
    hole = geo.cyl("Guitar_Hole", 0.045, 0.002, (0, -0.001, 0.40), m["hole"], c, rot=(90, 0, 0), seg=48)
    neck = geo.box("Guitar_Neck", (0.05, 0.03, 0.46), (0, 0.035, 0.63), m["rosewood"], c, bev=0.004)
    head = geo.box("Guitar_Head", (0.08, 0.02, 0.18), (0, 0.04, 1.09), m["rosewood"], c, rot=(-12, 0, 0), bev=0.004)
    bridge = geo.box("Guitar_Bridge", (0.15, 0.012, 0.025), (0, -0.006, 0.14), m["rosewood"], c, bev=0.002)
    parts = [body, hole, neck, head, bridge]
    for s in range(6):
        xs = (s - 2.5) * 0.008
        parts.append(geo.box(f"Guitar_String_{s}", (0.0012, 0.0012, 0.95), (xs, 0.012, 0.14), m["string"], c, bev=0))
    g = geo.join(parts, "Guitar")
    g.location = foot
    g.rotation_euler = (math.radians(-lean_deg), 0, math.radians(rot))
    return g


def build_desk(m):
    """Walnut writing desk on the north wall with a three-drawer pedestal at the far (east) end."""
    c = geo.coll("Desk")
    x0, x1, y0, y1 = 0.42, 2.30, D - 0.72, D - 0.02
    cy = (y0 + y1) / 2
    geo.box("Desk_Top", (x1 - x0, y1 - y0, 0.035), ((x0 + x1) / 2, cy, TOP - 0.035), m["walnut"], c, bev=0.004)
    geo.box("Desk_Side_W", (0.035, y1 - y0 - 0.04, TOP - 0.035), (x0 + 0.03, cy, 0), m["walnut"], c, bev=0.004)
    geo.box("Desk_Modesty", (x1 - x0 - 0.5, 0.02, 0.35), ((x0 + x1) / 2 - 0.2, y1 - 0.06, TOP - 0.40), m["walnut"], c, bev=0.003)
    px0 = x1 - 0.46
    geo.box("Desk_Pedestal", (0.44, y1 - y0 - 0.04, TOP - 0.035), (px0 + 0.22, cy, 0), m["walnut"], c, bev=0.004)
    for k, (z, hgt) in enumerate(((0.05, 0.24), (0.31, 0.17), (0.50, 0.17))):
        geo.box(f"Desk_Drawer_{k}", (0.40, 0.012, hgt - 0.02), (px0 + 0.22, y0 + 0.012, z), m["walnut"], c, bev=0.003)
        geo.cyl(f"Desk_Pull_{k}", 0.006, 0.09, (px0 + 0.22 - 0.045, y0 - 0.004, z + hgt / 2), m["string"], c, rot=(0, 90, 0), seg=12)
    return c


def build_desk_props(m):
    """The old intro's hero props (laptop, glass, mugs, phone, notebook, mouse, chair, monitor), moved by OFF."""
    import props_clutter
    import props_desk
    c = props_desk.build((3, 4))
    for n in ("Desk_Top", "Desk_Stretcher", "Lamp", "Clock", "Router", "Desk_Leg", "Desk_Post", "Desk_Arm",
              "Charger_Brick", "Takeaway"):
        for o in [o for o in c.objects if o.name.startswith(n)]:
            bpy.data.objects.remove(o, do_unlink=True)
    cm = props_clutter._mats()
    props_clutter.build_monitor(cm, c)
    for o in c.objects:
        if o.parent is None:
            o.location += OFF
    # the second screen, right of the first (left of the laptop is the glass shot's camera): code in an editor, static
    mx, my, rot = 2.02, 4.60, -40
    a = math.radians(rot)
    geo.box("Monitor2_Foot", (0.24, 0.19, 0.012), (mx, my + 0.02, TOP), m["black"], c, rot=(0, 0, rot), bev=0.004)
    geo.box("Monitor2_Neck", (0.05, 0.03, 0.30), (mx - math.sin(a) * 0.05, my + math.cos(a) * 0.05, TOP + 0.01),
            m["black"], c, rot=(0, 0, rot), bev=0.006)
    body = geo.box("Monitor2_Body", (0.62, 0.035, 0.37), (mx, my, TOP + 0.13), m["black"], c, rot=(-4, 0, rot), bev=0.006)
    s = geo.plane("Monitor2_Screen", (0.596, 0.336), (0, -0.0182, 0.185), m["code"], c, rot=(90, 0, 0))
    s.parent = body
    return c


def shelf_levels(o, min_area=0.02):
    """Heights of the shelf boards: up-facing faces inside the case, clustered."""
    bpy.context.view_layer.update()
    mw = o.matrix_world
    zs = sorted(round((mw @ p.center).z, 2) for p in o.data.polygons
                if (mw.to_3x3() @ p.normal).z > 0.9 and p.area * o.scale.x * o.scale.y > min_area)
    levels = []
    for z in zs:
        if not levels or z - levels[-1] > 0.15:
            levels.append(z)
    return levels


def fill_shelves(shelf):
    """Books on every board of the bookshelf (Poly Haven sets, a little scaled and turned so the rows differ)."""
    bpy.context.view_layer.update()                  # matrix_world is stale right after ph() moves it
    bb = [shelf.matrix_world @ Vector(v) for v in shelf.bound_box]
    y0, y1 = min(v.y for v in bb) + 0.05, max(v.y for v in bb) - 0.05
    rng = random.Random(9)
    for i, z in enumerate(shelf_levels(shelf)[:-1]):     # the top is for the photo and the fern
        y = y0
        while y < y1 - 0.25:
            sc = rng.uniform(0.62, 0.8)
            bk = ph("book_encyclopedia_set_01", (0.20, y, z + 0.002), rot=90, scale=sc,
                    name=f"Shelf_Books_{i}_{int(y * 100)}")
            dec = bk.modifiers.new("Lighter", "DECIMATE")      # seen across the room: ~12% of the scan is plenty
            dec.ratio = 0.12
            y += 0.55 * sc + rng.uniform(0.02, 0.10)


def build_story_wall(m):
    """The east wall behind Ivan, seen in the reverse shot from the desk: the door with a hoodie and headphones on a
    hook, a big film poster and a corkboard, a low console with his gadgets (a 3D printer, a NAS with blue LEDs, an old
    game console, a small warm lamp), a wardrobe in the corner, sneakers and a box on the floor."""
    import props_clutter
    c = geo.coll("StoryWall")
    xw = W                                            # the wall's inner face
    face = (90, 0, 90)                                # planes facing -x, into the room
    # the door: hooks with a hoodie and the headphones
    for k, y in enumerate((1.22, 1.70)):
        geo.cyl(f"Door_Hook_{k}", 0.006, 0.05, (xw - 0.02, y, 1.78), m["black"], c, rot=(0, -90, 0), seg=12)
    hood = props_clutter.cloth_heap("Hoodie_Door", (xw - 0.07, 1.22, 1.40), (0.05, 0.21, 0.40), m["cloth_grey"], c, seed=7)
    geo.torus("Headphones_Hang_Band", 0.085, 0.011, (xw - 0.05, 1.70, 1.66), m["black"], c, rot=(0, 90, 0), arc=200)
    for k, dy in enumerate((-0.075, 0.075)):
        geo.cyl(f"Headphones_Hang_Cup_{k}", 0.045, 0.035, (xw - 0.05, 1.70 + dy, 1.60), m["black"], c, rot=(0, 90, 0),
                seg=32, bev=0.006)
    geo.box("Light_Switch", (0.012, 0.08, 0.12), (xw - 0.006, 2.12, 1.12), m["trim"], c, bev=0.002)
    # the console under the poster
    cy0, cy1, ch, cd = 2.30, 3.70, 0.55, 0.42
    ccy = (cy0 + cy1) / 2
    geo.box("Console", (cd, cy1 - cy0, ch), (xw - cd / 2, ccy, 0.0), m["walnut"], c, bev=0.006)
    geo.box("Console_Shelf", (0.02, cy1 - cy0 - 0.12, 0.20), (xw - cd - 0.001, ccy, 0.06), m["black"], c, bev=0)
    for k, y in enumerate((cy0 + 0.35, cy1 - 0.35)):
        geo.box(f"Console_Drawer_{k}", (0.012, 0.62, 0.22), (xw - cd - 0.006, y, 0.29), m["walnut"], c, bev=0.003)
    top = ch
    # 3D printer: a black frame, orange parts, a glowing little screen
    px, py, ps = xw - 0.22, cy0 + 0.25, 0.36
    for k, (dx, dy) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        geo.box(f"Printer_Post_{k}", (0.02, 0.02, 0.42), (px + dx * ps / 2, py + dy * ps / 2, top), m["black"], c, bev=0.002)
    geo.box("Printer_Top", (ps + 0.02, ps + 0.02, 0.025), (px, py, top + 0.42), m["black"], c, bev=0.003)
    geo.box("Printer_Bed", (ps - 0.04, ps - 0.04, 0.012), (px, py, top + 0.10), m["printer_orange"], c, bev=0.002)
    geo.box("Printer_Head", (0.07, 0.07, 0.06), (px - 0.03, py + 0.04, top + 0.30), m["printer_orange"], c, bev=0.006)
    geo.box("Printer_Base", (ps + 0.02, ps + 0.02, 0.06), (px, py, top), m["black"], c, bev=0.004)
    geo.plane("Printer_Screen", (0.07, 0.035), (px - ps / 2 - 0.012, py, top + 0.035), m["printer_screen"], c, rot=face)
    # NAS with blue LEDs, an old console with a controller
    nx, ny = xw - 0.20, cy0 + 0.66
    geo.box("NAS", (0.20, 0.13, 0.19), (nx, ny, top), m["black"], c, bev=0.006)
    for k in range(3):
        geo.plane(f"NAS_LED_{k}", (0.006, 0.006), (nx - 0.101, ny - 0.04 + k * 0.03, top + 0.15), m["led_blue"], c, rot=face)
    gx, gy = xw - 0.22, cy0 + 0.95
    geo.box("Game_Console", (0.22, 0.26, 0.055), (gx, gy, top), m["console_grey"], c, bev=0.008)
    geo.plane("Game_Console_LED", (0.008, 0.008), (gx - 0.111, gy + 0.09, top + 0.03), m["led_green"], c, rot=face)
    geo.rounded_slab("Game_Pad", (0.14, 0.09, 0.03), 0.02, (gx - 0.05, gy + 0.20, top), m["console_grey"], c, rot=(0, 0, 25))
    # a small warm lamp at the console's corner end (the reverse shot's warm pool)
    lx, ly = xw - 0.18, cy1 - 0.12
    geo.cyl("Story_Lamp_Base", 0.06, 0.20, (lx, ly, top), m["lamp_ceramic"] if "lamp_ceramic" in m else m["black"], c, seg=32)
    geo.cyl("Story_Lamp_Shade", 0.11, 0.16, (lx, ly, top + 0.20), m["shade"], c, r_top=0.08, cap=False, seg=48)
    geo.cyl("Lamp_Bulb_Story", 0.02, 0.03, (lx, ly, top + 0.25), m["bulb"], c, seg=16)
    # the wall above: a film poster, the corkboard with notes and pinned plans
    geo.plane("Poster_Film", (0.62, 0.87), (xw - 0.004, 2.80, 1.62), m["poster_film"], c, rot=face)
    geo.box("Corkboard", (0.015, 0.70, 0.48), (xw - 0.0075, 3.55, 1.30), m["cork"], c, bev=0.002)
    geo.box("Corkboard_Frame", (0.012, 0.73, 0.51), (xw - 0.003, 3.55, 1.285), m["walnut"], c, bev=0.002)
    rng = random.Random(11)
    for k in range(7):
        w_, h_ = rng.choice(((0.10, 0.14), (0.15, 0.10), (0.21, 0.15), (0.08, 0.08)))
        mat = m[rng.choice(("note", "note", "sticky_y", "sticky_p"))]
        geo.plane(f"Cork_Note_{k}", (w_, h_), (xw - 0.017, 3.28 + rng.uniform(0, 0.52), 1.36 + rng.uniform(0, 0.36)), mat, c,
                  rot=(90 + rng.uniform(-4, 4), 0, 90))
    # the wardrobe in the north-east corner, sticky notes on a door
    wx0, wy0, wy1, wh = xw - 0.56, 3.95, 4.74, 1.95
    geo.box("Wardrobe", (xw - wx0, wy1 - wy0, wh), ((wx0 + xw) / 2, (wy0 + wy1) / 2, 0.0), m["walnut"], c, bev=0.008)
    for k, y in enumerate(((wy0 + wy1) / 2 - 0.19, (wy0 + wy1) / 2 + 0.19)):
        geo.box(f"Wardrobe_Door_{k}", (0.015, 0.37, wh - 0.12), (wx0 - 0.007, y, 0.06), m["bedwood"], c, bev=0.004)
        geo.cyl(f"Wardrobe_Knob_{k}", 0.012, 0.025, (wx0 - 0.02, y + (0.15 if k == 0 else -0.15), 1.05), m["string"], c,
                rot=(0, 90, 0), seg=16)
    for k in range(3):
        geo.plane(f"Wardrobe_Sticky_{k}", (0.07, 0.07), (wx0 - 0.016, wy0 + 0.10 + k * 0.06, 1.25 + (k % 2) * 0.09),
                  m["sticky_y" if k != 1 else "sticky_p"], c, rot=(90, 0, 90 + (k - 1) * 6))
    # floor: sneakers by the console, a box, a cable to the socket
    for k, (y, rz) in enumerate(((2.05, 12), (2.17, -8))):
        geo.rounded_slab(f"Sneaker_Sole_{k}", (0.29, 0.10, 0.03), 0.03, (xw - 0.55, y, 0.0), m["sole"], c, rot=(0, 0, 90 + rz))
        geo.rounded_slab(f"Sneaker_Upper_{k}", (0.25, 0.09, 0.07), 0.04, (xw - 0.55, y, 0.025), m["cloth_grey"], c,
                         rot=(0, 0, 90 + rz))
    ph("cardboard_box_01", (xw - 0.70, 3.82, 0), rot=-20, scale=0.85, name="Story_Box")
    geo.tube("Console_Cable", [Vector((xw - 0.05, cy0 + 0.5, top - 0.02)), Vector((xw - 0.03, cy0 + 0.5, 0.15)),
                               Vector((xw - 0.02, cy0 + 0.15, 0.02)), Vector((xw - 0.012, cy0 - 0.05, 0.25))], 0.003, m["black"], c)
    return (lx, ly, top + 0.25)


def build_dressing(m):
    """Everything from the top-down ref that makes the room lived-in."""
    c = geo.coll("Props")
    # NW corner by the bed head: nightstand with the lamp, alarm clock, books
    ns = ph("ClassicNightstand_01", (0.24, 0.62, 0), rot=90, name="Nightstand")
    lamp = build_lamp(m, (0.22, 0.52, 0.70))
    ph("alarm_clock_01", (0.22, 0.80, 0.70), rot=60, name="Alarm_Clock")
    ph("book_encyclopedia_set_01", (0.30, 0.86, 0.70), rot=0, scale=0.55, name="Nightstand_Books")
    ph("potted_plant_02", (0.24, 0.18, 0), rot=20, name="Plant_Corner")
    # south wall beyond the bed: side table with cans and a speaker
    geo.box("Side_Table", (0.46, 0.40, 0.52), (2.42, 0.24, 0.0), m["bedwood"], c, bev=0.006)
    for i, (dx, dy, mat) in enumerate(((-0.12, 0.05, "can_red"), (0.0, -0.06, "can_silver"), (0.1, 0.08, "can_red"))):
        geo.cyl(f"Soda_Can_{i}", 0.033, 0.122, (2.42 + dx, 0.24 + dy, 0.52), m[mat], c, seg=32)
    # by the window: the guitar on the wall, a dropped backpack and clothes
    gtr = glb("guitar.glb", (0.30, 3.48, 0.0), rot=-70, name="Guitar")    # on its stand in the window corner
    dec = gtr.modifiers.new("Lighter", "DECIMATE")
    dec.ratio = 0.3
    # the bookshelf in the window/desk corner, photo and a trailing plant on top
    shelf = ph("wooden_bookshelf_worn", (0.21, 4.36, 0), rot=90, scale=(0.62, 0.70, 0.92), name="Bookshelf")
    fill_shelves(shelf)
    ph("standing_picture_frame_01", (0.18, 4.20, 1.90), rot=110, name="Photo_Frame")
    ph("fern_02", (0.22, 4.55, 1.90), rot=30, scale=0.32, name="Plant_Shelf")
    # desk end: a tall plant; a small one on the desk
    ph("potted_plant_01", (2.62, 4.45, 0), rot=-40, name="Plant_Desk")
    ph("potted_plant_04", (2.12, 4.62, TOP), rot=15, name="Plant_DeskSmall")
    # east wall: a chest of drawers by the door
    # wall art: a band poster over the bed, a dev print by the door side, a retro print by the window (portrait 5:7)
    for i, (x, z, w_, mat) in enumerate(((0.88, 1.62, 0.50, "poster_band"), (2.55, 1.55, 0.44, "poster_dev"))):
        geo.plane(f"Poster_{i}", (w_, w_ * 1.4), (x, 0.004, z), m[mat], c, rot=(90, 0, 180))
    geo.plane("Poster_Window", (0.42, 0.59), (0.004, 0.50, 1.70), m["poster_hello"], c, rot=(90, 0, -90))
    # one rug, under the bed's foot and the desk chair (navy, look_target)
    geo.plane("Rug", (2.5, 2.2), (1.45, 3.25, 0.008), m["rug_oat"], c, rot=(0, 0, 0))
    # the desk lamp: a clamp arm lamp at the desk's left end, its head reaching over the laptop
    ph("desk_lamp_arm_01", (0.55, 4.70, TOP), rot=238, name="DeskLamp_Arm")
    geo.cyl("Lamp_Bulb_Desk", 0.018, 0.02, DESK_LAMP_HEAD, m["bulb"], c, seg=16)
    # desk life: headphones by the monitor, energy cans, a rubber duck, Sarah's photo, cables to the floor
    hx, hy = 1.74, 4.28
    geo.torus("Headphones_Band", 0.085, 0.011, (hx, hy, TOP + 0.03), m["black"], c, rot=(0, 72, 20), arc=200)
    for k, dx in enumerate((-0.07, 0.07)):
        geo.cyl(f"Headphones_Cup_{k}", 0.045, 0.035, (hx + dx * 0.35, hy + dx, TOP), m["black"], c, rot=(0, 0, 20),
                seg=32, bev=0.006)
    geo.cyl("Energy_Can", 0.033, 0.155, (2.22, 4.28, TOP), m["can_silver"], c, seg=32)
    geo.cyl("Energy_Can_2", 0.033, 0.155, (2.30, 4.38, TOP), m["can_silver"], c, seg=32)
    ph("rubber_duck_toy", (1.66, 4.66, TOP), rot=-150, scale=0.30, name="Rubber_Duck")
    ph("standing_picture_frame_02", (2.24, 4.62, TOP), rot=-140, scale=0.85, name="Photo_Sarah")
    for k, (p0, p1) in enumerate((((1.46, 4.66, TOP), (1.58, 4.76, 0.01)), ((2.02, 4.70, TOP), (1.70, 4.77, 0.01)),
                                   ((1.20, 4.62, TOP), (1.40, 4.77, 0.01)))):
        mx_ = (p0[0] + p1[0]) / 2
        geo.tube(f"Cable_Desk_{k}", [Vector(p0), Vector((mx_, 4.76, TOP - 0.02)), Vector((mx_ + 0.03, 4.775, 0.25)),
                                     Vector(p1)], 0.0035, m["black"], c)
    # floor: a laundry basket with clothes by the door, a moving box in the corner, a hoodie dropped by the bed
    import props_clutter
    ph("wicker_basket_01", (3.62, 0.86, 0), rot=15, scale=1.5, name="Laundry_Basket")
    props_clutter.cloth_heap("Laundry_Clothes", (3.62, 0.86, 0.17), (0.25, 0.19, 0.07), m["cloth_grey"], c, seed=4)
    ph("cardboard_box_01", (3.62, 0.40, 0), rot=8, scale=1.25, name="Moving_Box")
    props_clutter.cloth_heap("Hoodie_Floor", (2.32, 1.62, 0.04), (0.24, 0.18, 0.05), m["cloth_grey"], c, seed=2)
    # the phone, charging on the bed, its cable over the edge to the nightstand
    geo.rounded_slab("Phone_Bed", (0.0715, 0.147, 0.0078), 0.009, (0.92, 0.66, 0.482), m["black"], c, rot=(0, 0, 28))
    geo.tube("Phone_Cable", [Vector((0.95, 0.60, 0.484)), Vector((0.70, 0.58, 0.49)), Vector((0.50, 0.60, 0.47)),
                             Vector((0.40, 0.62, 0.62)), Vector((0.36, 0.64, 0.70))], 0.0025, m["cable_white"], c)
    return lamp


# ---------------------------------------------------------------------------------------------- outside
def blobs(name, points, r, mat, coll):
    """Many small round lights in one mesh (far street lights: the lens turns them into bokeh discs)."""
    bm = bmesh.new()
    for p in points:
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=__import__("mathutils").Matrix.Translation(p))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(mat)
    return o


def hill_z(x):
    """Ground height of the slope below the house: just under the floor at the wall, the valley floor by ~140 m."""
    return max(GROUND, -4.0 + 0.25 * x)


def build_exterior(m):
    """The valley city beyond the window (west, -x), in depth layers so the lens turns each into bokeh."""
    c = geo.coll("Exterior")
    rng = random.Random(11)
    grid_plane("Ground", (2600, 4000), (-1400, 2.4, GROUND - 0.1), m["ground"], c, (60, 8))
    # the hillside falls away from the house into the valley
    hill = bmesh.new()
    xs = [-3, -10, -25, -45, -70, -100, -140, -200]
    rows = [[hill.verts.new((x, y, hill_z(x))) for y in (-400, 400)] for x in xs]
    for a, b in zip(rows, rows[1:]):
        hill.faces.new((a[0], a[1], b[1], b[0]))
    me = bpy.data.meshes.new("Hill")
    hill.to_mesh(me)
    hill.free()
    ho = bpy.data.objects.new("Hill", me)
    c.objects.link(ho)
    me.materials.append(m["ground"])
    # 1. a tree line on the slope, seen through the window: dark crowns with city light between and behind them
    crowns = bmesh.new()
    for i in range(60):                                # crowns sit below eye level: the city shows above them
        x = -rng.uniform(16, 90)
        y = 2.4 + rng.uniform(-60, 60)
        h = rng.uniform(6, 10)
        z0 = hill_z(x)
        bmesh.ops.create_cone(crowns, cap_ends=True, segments=6, radius1=0.25, radius2=0.18, depth=h * 0.6,
                              matrix=Matrix.Translation((x, y, z0 + h * 0.3)))
        for k in range(rng.randint(3, 6)):
            r = rng.uniform(1.6, 3.2)
            cx, cy, cz = x + rng.uniform(-1.5, 1.5), y + rng.uniform(-1.8, 1.8), z0 + h * rng.uniform(0.55, 0.95)
            g = bmesh.ops.create_icosphere(crowns, subdivisions=2, radius=r,
                                           matrix=Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((1, 1, 0.8, 1)))
            for v in g["verts"]:
                v.co += (v.co - Vector((cx, cy, cz))) * (rng.random() * 0.35 - 0.12)
    me = bpy.data.meshes.new("Tree_Line")
    crowns.to_mesh(me)
    crowns.free()
    for poly in me.polygons:
        poly.use_smooth = True
    to = bpy.data.objects.new("Tree_Line", me)
    c.objects.link(to)
    me.materials.append(m["tree"])
    # 2. the neighbourhood down the hill: houses with a lit window or two, warm street lights along the roads
    houses, lights, wins = [], [], []
    for row in range(14):
        x = -40 - row * 26
        z = hill_z(x)                                    # the slope flattens into the valley
        for k in range(26):
            y = 2.4 + (k - 13) * 18 + rng.uniform(-5, 5)
            if rng.random() < 0.8:
                hw, hd, hh = rng.uniform(8, 13), rng.uniform(7, 11), rng.uniform(5, 8)
                houses.append(geo.box(f"House_{row}_{k}", (hd, hw, hh), (x + rng.uniform(-6, 6), y, z), m["roof"], c, bev=0))
                if rng.random() < 0.45:              # a lit window on the side facing us
                    wins.append(((x + hd / 2 + 0.05, y + rng.uniform(-hw / 3, hw / 3), z + rng.uniform(1.2, hh - 1.5)),
                                 rng.uniform(0.9, 1.6)))
            for j in range(2):                        # street lights along the road in front of each row
                lights.append(((x - 11, y + 4 + j * 9 + rng.uniform(-1, 1), z + 6.5), rng.random() < 0.72))
    geo.join(houses, "Neighbourhood")
    blobs("Street_Sodium", [p for p, warm in lights if warm], 0.22, m["sodium"], c)
    blobs("Street_LED", [p for p, warm in lights if not warm], 0.18, m["led_white"], c)
    quads = bmesh.new()                               # lit house windows: small warm panes facing the hill
    for (px, py, pz), wdt in wins:
        vs = [quads.verts.new((px, py + dy, pz + dz)) for dy, dz in ((-wdt / 2, -0.6), (wdt / 2, -0.6), (wdt / 2, 0.6), (-wdt / 2, 0.6))]
        quads.faces.new(vs)
    me = bpy.data.meshes.new("House_Windows")
    quads.to_mesh(me)
    quads.free()
    hw_ = bpy.data.objects.new("House_Windows", me)
    c.objects.link(hw_)
    me.materials.append(m["house_win"])
    # 2b. the valley floor: a carpet of small lights out to downtown (the ref's sea of bokeh)
    far = [(-rng.uniform(300, 1000), 2.4 + rng.uniform(-1000, 1000), GROUND + rng.uniform(0.5, 6)) for _ in range(3600)]
    blobs("Valley_Sodium", [p for p in far[:2300]], 0.7, m["sodium"], c)
    blobs("Valley_LED", [p for p in far[2300:]], 0.6, m["led_white"], c)
    # 3. downtown across the valley: towers with lit window grids (the engine draws them: 'Facade' material)
    towers = []
    for i in range(170):                               # slender towers, a taller core straight ahead
        x = -rng.uniform(800, 1900)
        y = 2.4 + rng.uniform(-1100, 1100) * (1 - abs(x + 1350) / 1600)
        core = abs(y - 2.4) < 380
        hgt = rng.uniform(60, 150) * (rng.uniform(1.5, 2.4) if core and rng.random() < 0.6 else 1.0)
        t = geo.box(f"Tower_{i}", (rng.uniform(16, 30), rng.uniform(16, 30), hgt), (x, y, GROUND), m["facade"], c, bev=0)
        towers.append(t)
        if hgt > 140:
            geo.cyl(f"Aviation_{i}", 1.2, 1.2, (x, y, GROUND + hgt + 1), m["aviation"], c, seg=8)
    for t in towers:
        metric_uv(t)
    geo.join(towers, "Facade_Towers")
    # 4. the sky: one far card, glow at the horizon
    geo.plane("Sky_Card", (9000, 2600), (-3200, 2.4, GROUND + 1100), m["sky"], c, rot=(90, 0, -90))
    squash_far(c)


EYE = Vector((0.0, 2.4, 1.3))


def squash_far(coll, near=120.0, room=270.0, fall=900.0):
    """The engine's camera sees 400 m; the valley is kilometres deep. Everything past `near` is pulled in along
    its line of sight from the window (d -> near + room * (1 - e^-(d-near)/fall)): every object keeps its angle
    and its angular size, so the view is the same, it just fits the depth range. The lens sees it all as infinity."""
    for o in coll.objects:
        if o.type != "MESH":
            continue
        mw, mi = o.matrix_world.copy(), o.matrix_world.inverted()
        for v in o.data.vertices:
            w = mw @ v.co
            d = -w.x
            if d <= near:
                continue
            k = (near + room * (1 - math.exp(-(d - near) / fall))) / d
            v.co = mi @ (EYE + (w - EYE) * k)


# ---------------------------------------------------------------------------------------------- cameras, render, export
def add_cams():
    c = geo.coll("Shots")
    cams = {}
    for name, (pos, at, mm, up) in SHOTS.items():
        data = bpy.data.cameras.new(f"Shot_{name}")
        data.lens, data.sensor_width, data.clip_start, data.clip_end = mm, 36, 0.02, 8000
        o = bpy.data.objects.new(f"Shot_{name}", data)
        c.objects.link(o)
        o.location = pos
        d = Vector(at) - Vector(pos)
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        if up:                                        # straight down: turn so the window wall (-x) is at the top
            o.rotation_euler = (0, 0, math.atan2(-up[0], up[1]))
        cams[name] = o
    return cams


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    m = mats()
    build_shell(m)
    build_window(m)
    build_bed(m)
    build_desk(m)
    build_desk_props(m)
    lamp = build_dressing(m)
    scene["story_lamp"] = list(build_story_wall(m))
    build_exterior(m)
    scene["lamp"] = list(lamp)
    return scene, add_cams()


# ---------------------------------------------------------------------------------------------- night light (3 AM)
# Times of day, all on the same geometry (so the engine can blend their lightmaps). The window is read as facing
# east for the chapter's sunrise; nothing in the set changes, only where the light comes from.
#   sun: (strength, colour, travel direction) through the window; window: the sky panel outside it (W, colour);
#   city: the valley's lights and the sky card as light sources; screens: the monitors' and laptop's emission.
PRESETS = {
    "3am":     dict(world=((0.004, 0.006, 0.016), (0.03, 0.03, 0.05), 1.0), lamp=105, window=(140, (0.36, 0.46, 1.0)),
                    moon=0.0, sun=None, sodium=0, fill=0, city=1.0, screens=1.0, desk=9, story=14, exposure=1.35),
    "evening": dict(world=((0.03, 0.04, 0.12), (0.55, 0.28, 0.14), 1.2), lamp=240, window=(900, (1.0, 0.56, 0.36)),
                    moon=0.0, sun=None, sodium=0, fill=0, city=0.7, screens=1.0, desk=18, exposure=1.0),
    "day":     dict(world=((0.25, 0.35, 0.60), (0.60, 0.60, 0.58), 1.5), lamp=0, window=(2600, (0.85, 0.90, 1.0)),
                    moon=0.0, sun=(4.0, (1.0, 0.90, 0.78), (1.0, 0.30, -0.62)), sodium=0, fill=0, city=0.0, screens=0.5,
                    desk=0, exposure=0.1),
    "sunrise": dict(world=((0.12, 0.16, 0.30), (0.90, 0.50, 0.25), 2.0), lamp=240, window=(700, (1.0, 0.68, 0.48)),
                    moon=0.0, sun=(5.0, (1.0, 0.58, 0.32), (1.0, -0.20, -0.13)), sodium=0, fill=0, city=0.1, screens=0.8,
                    desk=18, exposure=0.6),
}
CITY_LIGHTS = ("Sodium Light", "Street LED", "House Window LED", "Facade City", "Aviation Red", "Sky Night")
SCREEN_MATS = ("Laptop Screen", "Monitor Screen", "Code Screen", "Phone Screen")


def _emission(name, k):
    m = bpy.data.materials.get(name)
    if not m or not m.use_nodes:
        return
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Emission Strength"].default_value *= k
        elif n.type == "EMISSION":
            n.inputs["Strength"].default_value *= k


def light_rig(scene, preset="3am"):
    """The rig for Cycles (the bake) and lights.json (the engine's live lights), per time of day.
    3am starts from the intro's 3am preset (lighting.PRESETS) so both films share one exposure."""
    import lighting
    p = PRESETS[preset]
    c = geo.coll("Lighting")
    lighting.world_sky(*p["world"])
    for o in bpy.data.objects:                      # window panes must not block the outside light (no caustics);
        if o.name.startswith("Window_Glass") or \
                (any(c.name == "Exterior" for c in o.users_collection) and not o.name.startswith("Tree_")):
            o.visible_shadow = False                # nor may the sky card and the far city shade the moon or sun
    for n in CITY_LIGHTS:
        _emission(n, p["city"])
    for n in SCREEN_MATS:
        _emission(n, p["screens"])
    lamp = Vector(scene["lamp"])
    L = lighting._light
    # the room's key at night: warm everywhere (energy 0 keeps the light, so every preset has the same live list)
    L("Desk_Lamp", "POINT", tuple(lamp - Vector((0, 0, 0.06))), max(p["lamp"], 0.001), (1.0, 0.66, 0.42), c, shadow_soft=0.20)
    if p.get("story"):                              # the console lamp on the story wall: a small amber pool behind Ivan
        L("Story_Lamp", "POINT", tuple(Vector(scene["story_lamp"])), p["story"], (1.0, 0.64, 0.40), c, shadow_soft=0.12)
    # a fabric shade glows and lets light through; as an opaque blocker its rim cut hard shapes into the wall, the
    # poster and the bed (LESSONS.md). Same for the desk lamp's small shade.
    for n in ("Lamp_Shade", "DeskLamp_Arm", "Story_Lamp_Shade"):
        if n in bpy.data.objects:
            bpy.data.objects[n].visible_shadow = False
    bpy.context.view_layer.update()
    hinge = bpy.data.objects["Laptop_Hinge"]
    L("Key_Laptop", "AREA", tuple(hinge.matrix_world @ Vector((0, -0.01, 0.112))), 4.0 * p["screens"], (0.62, 0.74, 1.0), c,
      size=(0.29, 0.18), target=(1.05, 3.75, 1.15))
    # the sky through the window: a panel outside it, coloured by the time of day
    cy = (WIN_Y0 + WIN_Y1) / 2
    # the night sky outside the window: a big, far, soft source (the window frames it; nothing burns)
    L("City_West", "AREA", (-4.5, cy, (SILL + HEAD) / 2 + 1.0), p["window"][0], p["window"][1], c,
      size=(7.0, 4.0), target=(2.2, cy, 0.6))
    if p.get("desk"):                               # the small warm desk lamp
        # soft (15 cm): a 3 cm point threw hard streaks from the desk and chair legs over the floor and the bed
        L("Desk_Practical", "POINT", tuple(Vector(DESK_LAMP_HEAD) - Vector((0, 0, 0.04))), p["desk"], (1.0, 0.62, 0.34), c,
          shadow_soft=0.15)
    if p["moon"]:
        moon = bpy.data.lights.new("Moon", "SUN")
        moon.energy, moon.color, moon.angle = p["moon"], (0.58, 0.70, 1.0), math.radians(9.0)   # hazy moon: a soft wash
        mo = bpy.data.objects.new("Moon", moon)
        c.objects.link(mo)
        mo.rotation_euler = Vector(MOON).to_track_quat("-Z", "Y").to_euler()
    if p["sun"]:                                    # through the window: mullions and blinds print on the room
        k, col, d = p["sun"]
        sun = bpy.data.lights.new("Sun", "SUN")
        sun.energy, sun.color, sun.angle = k, col, math.radians(1.0)
        so = bpy.data.objects.new("Sun", sun)
        c.objects.link(so)
        so.rotation_euler = Vector(d).to_track_quat("-Z", "Y").to_euler()
    if p["sodium"]:
        for i, y in enumerate((WIN_Y0 + 0.5, WIN_Y1 - 0.6)):
            L(f"Sodium_{i}", "SPOT", (-7.0, y, -3.0), p["sodium"], (1.0, 0.50, 0.16), c, spot=(12, 0.7),
              target=(1.6, y + 0.3, H), shadow_soft=0.3)
    # the room's fill: lamp light scattered off the ceiling, walls and bedding, the soft low glow every corner of
    # the reference has (shadows never fall to black). A broad, dim, warm panel just under the ceiling.
    if p["fill"]:
        L("Room_Fill", "AREA", (W / 2, D / 2, H - 0.05), p["fill"], (1.0, 0.80, 0.62), c, size=(W * 0.8, D * 0.8),
          target=(W / 2, D / 2, 0))
    scene.view_settings.exposure = p["exposure"]


def bake_and_export(out, scene, small=False, samples=64, preset="3am", lm_only=False):
    """Cycles lightmaps for the set (lightmap.py: irradiance minus the live lights), then room.glb + lights.json."""
    import bake as BK
    import export_intro as X
    import lightmap
    BK.FLAT_ALBEDO = True                           # procedural colours baked black: the floor, the bed (LESSONS.md)
    lightmap.LIVE_LIGHTS = ("Key_Laptop",)          # the lamp is baked: soft Cycles shadows instead of a hard shadow map
    BK.DESK = Vector((1.3, 4.4, 0.0))               # the desk zone gets its own, sharper map
    bpy.data.objects["Wall_N"]["bake_group"] = "WALLN"   # wild wall and ceiling: own maps, so shots can pull them
    bpy.data.objects["Ceiling"]["bake_group"] = "CEIL"
    X.curves_to_meshes()
    for o in bpy.data.objects:                      # children of meshes that get joined into a bake group (the monitor's
        if o.parent and o.parent.type == "MESH":     # screen and stickies) would lose their place: keep them in world space
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    light_rig(scene, preset)
    groups = {"ARCH": 4096, "DESK": 2048, "ROOM": 4096, "PROPS": 2048, "WALLN": 1024, "CEIL": 1024}
    write_lights(out, scene, groups=list(groups), exposure=scene.view_settings.exposure)
    if "--preview" in sys.argv:                      # look-dev: half-size maps, minutes instead of half an hour
        groups = {g: s // 2 for g, s in groups.items()}
    lightmap.bake_lightmaps(out / "lightmaps", sizes={g: 128 for g in groups} if small else groups,
                            samples=4 if small else samples, live_samples=2 if small else max(24, samples // 2), device="GPU",
                            reuse="--resume" in sys.argv)
    if lm_only:                                      # another time of day on the same geometry: lightmaps + lights.json
        print("BAKED", preset, out, flush=True)
        return
    X.strip_for_web()
    export_glb(out)


def write_lights(out, scene, groups=None, exposure=0.0):
    import json
    bpy.context.view_layer.update()                  # light rotations set by target= are not in matrix_world yet
    ob = bpy.data.objects
    at = lambda n: [round(v, 4) for v in ob[n].matrix_world.translation]   # noqa: E731
    lights = []
    for o in ob:
        if o.type != "LIGHT":
            continue
        d = o.data
        rec = {"name": o.name, "type": d.type, "energy_w": d.energy, "color": list(d.color), "location": list(o.location),
               "forward": list(o.matrix_world.to_3x3() @ Vector((0, 0, -1)))}
        if d.type == "AREA":
            rec["size"] = [d.size, d.size_y]
        if d.type == "POINT":
            rec.update(radius=d.shadow_soft_size, spot_deg=120, blend=1)
        lights.append(rec)
    if not any(r["name"] == "Desk_Lamp" for r in lights):     # unlit export (layout checks): the lamp + laptop marks
        lights = [{"name": "Desk_Lamp", "type": "POINT", "energy_w": 22, "color": [1.0, 0.60, 0.30], "location": list(scene["lamp"]),
                   "forward": [0, 0, -1], "spot_deg": 120, "blend": 1, "radius": 0.05},
                  {"name": "Key_Laptop", "type": "AREA", "energy_w": 4, "color": [0.62, 0.74, 1.0], "location": at("Laptop_Screen"),
                   "forward": [0, -1, 0], "size": [0.29, 0.18]}]
    marks = {n: at(n) for n in ("Lamp_Shade", "Laptop_Screen", "Monitor_Screen", "Monitor2_Screen", "Water_Glass", "Phone")
             if n in ob}
    marks["Window"] = [-0.17, (WIN_Y0 + WIN_Y1) / 2, (SILL + HEAD) / 2]
    out.mkdir(parents=True, exist_ok=True)
    rec = {"lights": lights, "marks": marks, "exposure": exposure, "offset": list(OFF),
           "room": {"w": W, "d": D, "h": H, "window": [WIN_Y0, WIN_Y1, SILL, HEAD]}}
    if groups:
        rec["groups"] = groups
    (out / "lights.json").write_text(json.dumps(rec, indent=1))


def render_grey(scene, cams, names, out, res):
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light, sh.color_type = "STUDIO", "TEXTURE"
    sh.show_shadows, sh.show_cavity = True, True
    sh.shadow_intensity = 0.5
    scene.display.light_direction = (0.6, 0.2, 0.75)
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.view_settings.view_transform = "Standard"
    paths = []
    for n in names:
        ceil = bpy.data.objects["Ceiling"]
        ceil.hide_render = n == "top"                  # the reference looks down into the room
        scene.camera = cams[n]
        scene.render.filepath = str(out / f"grey_{n}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


def export_glb(out):
    """room.glb for engine/scenes/s03 (the Studio reloads when it changes)."""
    for o in bpy.data.objects:
        if o.type == "CAMERA":
            o.hide_render = True
    # scanned textures: 1K for furniture and plants, 512 for small props (the engine sees them at most ~1 m away)
    small = ("alarm_clock", "standing_picture", "potted_plant_04", "book_encyclopedia", "fern_02")
    for im in bpy.data.images:
        if im.size[0] > 1024 or (im.size[0] > 512 and im.name.startswith(small)):
            n = 512 if im.name.startswith(small) else 1024
            im.scale(n, n)
    bpy.ops.export_scene.gltf(filepath=str(out / "room.glb"), export_format="GLB", export_apply=True, export_cameras=False,
                              export_lights=False, export_yup=True, export_extras=True, export_animations=False,
                              export_image_format="AUTO", export_jpeg_quality=88)
    print("EXPORTED", out / "room.glb", round((out / "room.glb").stat().st_size / 1e6, 2), "MB", flush=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    opt = lambda f, d: args[args.index(f) + 1] if f in args else d   # noqa: E731
    scene, cams = build()
    if "--blend" in args:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "room03.blend"))
    if "--bake" in args:                             # the finished set: lightmaps + room.glb + lights.json
        bake_and_export(out, scene, small="--small" in args, samples=int(opt("--samples", "64")),
                        preset=opt("--preset", "3am"), lm_only="--lm-only" in args)
        sys.exit(0)
    if "--export" in args:                           # layout only, unlit (fast)
        write_lights(out, scene)
        export_glb(out)
        sys.exit(0)
    res = tuple(int(v) for v in opt("--res", "1376x768").split("x"))
    print("rendered", render_grey(scene, cams, opt("--cams", "top,door").split(","), out, res))
