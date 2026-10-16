"""Chapter 1 keyframes (kf1) only: Ivan's bed rebuilt as cloth (round 14, ref R1: a mattress on the floor in a navy
sheet with a visible weave, soft folds, a beige pillow). Written to engine/scenes/kf1/bed.glb; the engine hides the
set's bed (Baked_ROOM duvet, sheet, pillows) in kf1 only and lights this one with the room's own baked light
(engine/scenes/kf1/room.js moves the old bed's lightmap onto it per vertex). s03 keeps its bed.

    blender -b --factory-startup -P blender/scenes/kf1_bed.py -- engine/scenes/kf1/bed.glb [--blend out.blend]

Same footprint as set_room03.build_bed (mattress 1.58 x 2.01 x 0.22 on the floor, head on the south wall):
  - the mattress: a soft-edged cloth box, a piped seam round the top, the fitted sheet's wrinkles gathered at the
    corners and a shallow give across the top;
  - the duvet: a real cloth simulation (Blender cloth) dropped over the lower two thirds, so it hangs over the sides and
    the foot in its own heavy folds and pools a little on the floor (no more painted sine hem); its head edge turned back;
  - two pillows: stuffed-case shapes (bulging sides, pinched seam corners, creases into the corners), one flat, one
    propped against the wall.
Metric UVs (1 unit = 1 m) so the engine's tiling weave keeps one density.
"""
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402

X0, X1, Y0, Y1 = 0.48, 2.10, 0.04, 2.16           # set_room03.build_bed's frame footprint
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2 + 0.03
MW, MD, MH = X1 - X0 - 0.04, Y1 - Y0 - 0.11, 0.22   # the mattress
FOLD = False                                        # the duvet's turned-back head edge (read as a stripe: off)


def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bs.inputs["Base Color"].default_value = (*rgb, 1)
    bs.inputs["Roughness"].default_value = 0.95
    return m


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def metric_uv(o, axis_pref=None):
    """Box projection in world metres."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    mw = o.matrix_world
    rot = mw.to_3x3()
    for f in bm.faces:
        n = rot @ f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            p = mw @ lp.vert.co
            lp[uv].uv = (p.y, p.z) if ax == 0 else (p.x, p.z) if ax == 1 else (p.x, p.y)
    bm.to_mesh(me)
    bm.free()


def apply_mods(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me


# ----------------------------------------------------------------------------------------------- mattress
def ridged(v, k=1.0):
    """1 at a crease line, 0 between: ridged noise (sharp folds, soft valleys), never a sine."""
    return (1.0 - abs(noise.noise(v))) ** k


def mattress():
    """A soft mattress in a fitted sheet (R1): fully rounded top and bottom edges, sides that bulge, a crown that sags
    a little in the middle, the sheet gathered into creases at the corners, slack folds down the sides, the elastic's
    gathers along the bottom, a piped seam. Moved into the vertices of a dense even mesh (a displacement the camera
    reads in daylight from the top-downs and from 3/4)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * MW, v.co.y * MD, (v.co.z + 0.5) * MH))
    me = bpy.data.meshes.new("Kf1_Mattress")
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new("Kf1_Mattress", me))
    o.location = (CX, CY, 0.0)
    bv = o.modifiers.new("Corners", "BEVEL")       # rounded plan corners
    bv.width, bv.segments, bv.affect = 0.10, 10, "VERTICES"
    o.modifiers.new("Tri", "TRIANGULATE")
    apply_mods(o)
    bv = o.modifiers.new("Edge", "BEVEL")          # the soft roll of the top and bottom edges: nearly half the height
    bv.width, bv.segments, bv.limit_method = 0.075, 12, "ANGLE"
    apply_mods(o)
    rm = o.modifiers.new("Remesh", "REMESH")       # even, dense quads for the displacement
    rm.mode, rm.voxel_size, rm.use_smooth_shade = "VOXEL", 0.010, True
    apply_mods(o)
    sm = o.modifiers.new("Smooth", "SMOOTH")       # the voxel steps out of the round edges
    sm.factor, sm.iterations = 0.6, 4
    apply_mods(o)
    corners = [Vector((CX + sx * (MW / 2 - 0.04), CY + sy * (MD / 2 - 0.04), MH * 0.8)) for sx in (-1, 1) for sy in (-1, 1)]
    hw, hd = MW / 2, MD / 2
    me = o.data
    mw = o.matrix_world
    mi = mw.inverted().to_3x3()
    for v in me.vertices:
        p = mw @ v.co
        n = (mw.to_3x3() @ v.normal).normalized()
        u, w = (p.x - CX) / hw, (p.y - CY) / hd
        zt = min(1.0, max(0.0, p.z / MH))
        side = abs(n.z) < 0.7
        top = n.z >= 0.7
        d = 0.0
        if side:                                    # the sides bulge: stuffing pushing the sheet out
            d += 0.016 * math.sin(math.pi * zt) ** 0.8
        if top:                                     # a crown, a little sag in the middle where he would lie
            d += 0.010 * (1 - u * u) * (1 - w * w) - 0.006 * math.exp(-((u + 0.1) ** 2 + (w - 0.1) ** 2) / 0.25)
        # the fitted sheet gathered at the corners: creases radiating from each corner, sharp ridges, soft valleys
        for c in corners:
            r = (Vector((p.x, p.y)) - Vector((c.x, c.y))).length
            if r < 0.55:
                ang = math.atan2(p.y - c.y, p.x - c.x)
                fall = (1 - r / 0.55) ** 1.5
                d += 0.009 * fall * (ridged(Vector((ang * 2.4, r * 3.0, c.x + c.y)), 2.0) - 0.35)
        if side:                                    # slack folds down the sides, the elastic's gathers at the bottom
            along = p.x if abs(n.y) > abs(n.x) else p.y
            d += 0.0045 * (ridged(Vector((along * 5.5, zt * 1.2, 0.7)), 2.0) - 0.4) * (0.4 + 0.6 * zt)
            d += 0.0030 * (ridged(Vector((along * 26.0, 0.3, 4.4)), 3.0) - 0.3) * max(0.0, 1 - zt / 0.28)
        if top:                                     # soft long creases across the top (a sheet that has been slept on)
            d += 0.0030 * (ridged(Vector((p.x * 2.6 + p.y * 1.1, p.y * 0.9, 0.3)), 3.0) - 0.25)
            d += 0.0010 * noise.noise(Vector((p.x * 11, p.y * 11, 4.1)))
        # the piped seam: a bead just under the top edge (and round the bottom), a groove under it
        if side:
            hz = p.z - (MH - 0.035)
            d += 0.0035 * math.exp(-(hz / 0.005) ** 2) - 0.0020 * math.exp(-((hz + 0.010) / 0.006) ** 2)
            d += 0.0025 * math.exp(-((p.z - 0.035) / 0.005) ** 2)
        v.co += mi @ (n * d)
    for p in me.polygons:
        p.use_smooth = True
    return o


# ----------------------------------------------------------------------------------------------- pillows
def pillow(name, size, loc, rot, seed, dent=0.0):
    """A stuffed case: bulging sides, pinched seam corners, creases running into the corners."""
    a, b, T0 = size[0] / 2, size[1] / 2, size[2] / 2
    rng = random.Random(seed)
    N, M = 72, 48
    bm = bmesh.new()
    grid = {}
    for side in (1, -1):
        for i in range(N + 1):
            for j in range(M + 1):
                u, v = -1 + 2 * i / N, -1 + 2 * j / M
                edge = i in (0, N) or j in (0, M)
                if edge and side == -1 and (i, j, 1) in grid:
                    grid[(i, j, -1)] = grid[(i, j, 1)]
                    continue
                x = a * u * (1 + 0.06 * (1 - v * v))       # the sides bulge, the corners stay pinched
                y = b * v * (1 + 0.08 * (1 - u * u))
                prof = max(0.0, (1 - u * u)) ** 0.42 * max(0.0, (1 - v * v)) ** 0.42
                t = T0 * prof
                t *= 1 - dent * math.exp(-((u + 0.1) ** 2 + (v * 1.2) ** 2) / 0.35)
                # creases into the corners: ridges along the diagonals near each corner, and the seam waves
                cu, cv = abs(u), abs(v)
                cw = max(0.0, cu + cv - 1.15)
                ang = math.atan2(cv, cu)
                t += 0.006 * cw * math.sin(ang * 14 + seed) * prof ** 0.3
                t += 0.0018 * noise.noise(Vector((u * 3.1 + seed, v * 3.3, side * 0.5)))
                z = side * t if side == 1 else -min(t * 0.55, 0.03 + 0.15 * t)   # it rests flatter on the bed
                z += 0.004 * math.sin(u * 7.0 + seed) * (1 - prof) + 0.003 * math.sin(v * 9.0 + seed * 2) * (1 - prof)
                grid[(i, j, side)] = bm.verts.new((x, y, z))
    for side in (1, -1):
        for i in range(N):
            for j in range(M):
                q = [grid[(i, j, side)], grid[(i + 1, j, side)], grid[(i + 1, j + 1, side)], grid[(i, j + 1, side)]]
                if side == -1:
                    q.reverse()
                try:
                    bm.faces.new(q)
                except ValueError:
                    pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    o.location = loc
    o.rotation_euler = tuple(math.radians(r) for r in rot)
    for p in me.polygons:
        p.use_smooth = True
    if hasattr(me, "set_sharp_from_angle"):
        me.set_sharp_from_angle(angle=math.radians(50))   # the piping stays a crisp line
    return o


# ----------------------------------------------------------------------------------------------- duvet
def cloth_sim(o, colliders, frames, quality=8, mass=0.6, bend=2.0, pin=None):
    for c in colliders:
        md = c.modifiers.new("Collision", "COLLISION")
        c.collision.thickness_outer = 0.004
        c.collision.cloth_friction = 8
    cl = o.modifiers.new("Cloth", "CLOTH")
    s = cl.settings
    s.quality, s.mass = quality, mass
    s.tension_stiffness = s.compression_stiffness = 18
    s.shear_stiffness = 6
    s.bending_stiffness = bend
    s.air_damping = 2.0
    cl.collision_settings.collision_quality = 4
    cl.collision_settings.distance_min = 0.004
    cl.collision_settings.use_self_collision = True
    cl.collision_settings.self_distance_min = 0.004
    if pin:
        s.vertex_group_mass = pin
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me
    o.matrix_world = Matrix.Identity(4)           # the sim's result is in world space already
    sc.frame_set(1)
    for c in colliders:
        for md in [m for m in c.modifiers if m.type == "COLLISION"]:
            c.modifiers.remove(md)


def duvet(colliders):
    """A cloth sheet laid over the lower two thirds and dropped: it hangs and folds on its own."""
    hw = MW / 2 + 0.17                               # hangs most of the way down the sides
    v0, v1 = 1.22, Y1 + 0.14                         # round 14 b: a blanket over the foot half (R1 shows the sheeted mattress), past the foot
    nu, nv = 110, 100
    bm = bmesh.new()
    rows = []
    rng = random.Random(9)
    for j in range(nv + 1):
        y = v0 + (v1 - v0) * j / nv
        row = []
        for i in range(nu + 1):
            x = CX - hw + 2 * hw * i / nu
            z = MH + 0.07 + 0.02 * noise.noise(Vector((x * 2.5, y * 2.5, 0.4))) + 0.006 * noise.noise(Vector((x * 7, y * 7, 2.2)))   # unevenness seeds the folds
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new("Kf1_Duvet")
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new("Kf1_Duvet", me))
    cloth_sim(o, colliders, frames=80, mass=0.5, bend=0.35)
    # the hanging sides and foot: soft, irregular vertical folds that open toward the hem (the sim alone hangs them
    # as flat panels); not the old sine hem, a little flare at the bottom
    hx, hy = MW / 2, CY + MD / 2
    for v in o.data.vertices:
        p = v.co
        drop = max(0.0, (MH - 0.01) - p.z) / MH
        if drop <= 0:
            continue
        amp = 0.034 * drop ** 1.1
        if p.y > hy - 0.03:                          # the foot
            n = noise.noise(Vector((p.x * 4.6, 0.3, 1.7))) + 0.4 * noise.noise(Vector((p.x * 11.0, 2.1, 0.4)))
            p.y += amp * (0.6 + n) + 0.008 * drop ** 2
        if abs(p.x - CX) > hx - 0.03:                # the long sides
            s = 1 if p.x > CX else -1
            n = noise.noise(Vector((p.y * 4.6, 5.3 * s, 0.9))) + 0.4 * noise.noise(Vector((p.y * 11.0, 1.3 * s, 3.1)))
            p.x += s * (amp * (0.6 + n) + 0.008 * drop ** 2)
    # a few organic creases across the top, where a duvet laid by hand settles: ridges along long diagonal lines
    for v in o.data.vertices:
        p = v.co
        if p.z < MH + 0.01:
            continue
        cr = ridged(Vector((p.x * 2.1 + p.y * 1.4, p.y * 0.8 - p.x * 0.3, 1.9)), 3.0)
        cr2 = ridged(Vector((p.x * 3.6 - p.y * 1.9, p.y * 1.2, 7.7)), 4.0)
        p.z += 0.012 * cr + 0.007 * cr2 - 0.006
    if not FOLD:                                     # a made bed: one duvet, its thick, rounded edge
        sol = o.modifiers.new("Thick", "SOLIDIFY")
        sol.thickness, sol.offset = 0.045, 1
        sol.use_rim = True
        sub = o.modifiers.new("Sub", "SUBSURF")
        sub.levels = sub.render_levels = 1
        apply_mods(o)
        for p in o.data.polygons:
            p.use_smooth = True
        return [o]
    # the head edge turned back: a second, narrow layer laid over the top and dropped onto the duvet
    fb = bmesh.new()
    rows = []
    w0, w1 = v0 - 0.005, v0 + 0.30
    for j in range(31):
        y = w0 + (w1 - w0) * j / 30
        row = []
        for i in range(nu + 1):
            x = CX - (hw - 0.01) + 2 * (hw - 0.01) * i / nu
            row.append(fb.verts.new((x, y, MH + 0.16)))
        rows.append(row)
    for j in range(30):
        for i in range(nu):
            fb.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new("Kf1_Duvet_Fold")
    fb.to_mesh(me)
    fb.free()
    f = link(bpy.data.objects.new("Kf1_Duvet_Fold", me))
    cloth_sim(f, colliders + [o], frames=50, mass=0.5, bend=0.6)
    for x in (o, f):
        sol = x.modifiers.new("Thick", "SOLIDIFY")
        sol.thickness, sol.offset = 0.022, 1
        sub = x.modifiers.new("Sub", "SUBSURF")
        sub.levels = sub.render_levels = 1
        apply_mods(x)
        for p in x.data.polygons:
            p.use_smooth = True
    # the fold's turned edge: a soft roll joining the two layers
    roll = bpy.data.meshes.new("Kf1_Duvet_Roll")
    rb = bmesh.new()
    dg = bpy.context.evaluated_depsgraph_get()
    # sample the duvet's height along the head edge to sit the roll on it
    pts = []
    for i in range(nu + 1):
        x = CX - (hw - 0.01) + 2 * (hw - 0.01) * i / nu
        hit, loc, nrm, idx = o.ray_cast(Vector((x, v0 + 0.02, 2.0)), Vector((0, 0, -1)))
        if hit:
            pts.append(Vector((x, v0 + 0.012, loc.z)))
    rings = []
    for p in pts:
        ring = []
        for k in range(12):
            a = 2 * math.pi * k / 12
            ring.append(rb.verts.new(p + Vector((0, 0.014 * math.cos(a), 0.016 + 0.016 * math.sin(a)))))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(12):
            rb.faces.new((r0[k], r0[(k + 1) % 12], r1[(k + 1) % 12], r1[k]))
    rb.to_mesh(roll)
    rb.free()
    r = link(bpy.data.objects.new("Kf1_Duvet_Roll", roll))
    for p in roll.polygons:
        p.use_smooth = True
    return [o, f, r]


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(args[0]).resolve() if args else HERE.parents[1] / "engine/scenes/kf1/bed.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sheet_m, duvet_m, pillow_m = mat("Kf1 Sheet", (0.020, 0.035, 0.10)), mat("Kf1 Duvet", (0.013, 0.021, 0.058)), mat("Kf1 Pillow", (0.55, 0.40, 0.21))
    m = mattress()
    m.data.materials.append(sheet_m)
    floor = bpy.data.objects.new("Floor", bpy.data.meshes.new("Floor"))
    fb = bmesh.new()
    bmesh.ops.create_grid(fb, x_segments=1, y_segments=1, size=3.0)
    fb.to_mesh(floor.data)
    fb.free()
    link(floor)
    wall = bpy.data.objects.new("WallS", bpy.data.meshes.new("WallS"))
    wb = bmesh.new()
    bmesh.ops.create_cube(wb, size=1.0)
    for v in wb.verts:
        v.co = Vector((v.co.x * 4, v.co.y * 0.1 - 0.05, (v.co.z + 0.5) * 2.7))
    wb.to_mesh(wall.data)
    wb.free()
    link(wall)
    # pillows: one flat against the wall, one propped up on the wall behind it, a little askew
    p1 = pillow("Kf1_Pillow_0", (0.70, 0.48, 0.17), (CX - 0.30, Y0 + 0.62, MH + 0.03), (0, 0, -3), seed=3, dent=0.10)
    p2 = pillow("Kf1_Pillow_1", (0.64, 0.44, 0.16), (CX + 0.36, Y0 + 0.22, MH + 0.12), (-34, 0, 5), seed=7, dent=0.0)
    for p in (p1, p2):
        p.data.materials.append(pillow_m)
    bpy.context.view_layer.update()
    parts = duvet([m, floor, p1, p2, wall])
    for p in parts:
        p.data.materials.append(duvet_m)
    for o in (floor, wall):
        bpy.data.objects.remove(o, do_unlink=True)
    for o in [m, p1, p2] + parts:
        if o.modifiers:
            apply_mods(o)
        bpy.context.view_layer.update()
        o.data.transform(o.matrix_world)              # world-space vertices, identity transforms
        o.matrix_world = Matrix.Identity(4)
        metric_uv(o)
    # one object, one lightmap atlas ("LM", TEXCOORD_1): blender/scenes/kf1_dawn_bake.py --bed bakes the room's light
    # into it for each time of day, the engine reads it like the set's own lightmaps
    bpy.ops.object.select_all(action="DESELECT")
    objs = [m, p1, p2] + parts
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = m
    bpy.ops.object.join()
    bed = bpy.context.view_layer.objects.active
    bed.name = "Kf1_Bed"
    bed.data.uv_layers[0].name = "UVMap"
    uv = bed.data.uv_layers.new(name="LM")
    bed.data.uv_layers.active = uv
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    bed.data.uv_layers[0].name = "UVMap"
    bed.data.uv_layers.active = bed.data.uv_layers["UVMap"]
    bed.data.uv_layers["UVMap"].active_render = True
    if "--blend" in args:
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(args[args.index("--blend") + 1]).resolve()))
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True,
                              export_cameras=False, export_lights=False, export_animations=False)
    print("EXPORTED", out, round(out.stat().st_size / 1e6, 2), "MB",
          {o.name: len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH"}, flush=True)


main()
