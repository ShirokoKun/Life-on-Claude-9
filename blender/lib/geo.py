"""Small modelling toolkit for headless Blender: every helper returns a finished object."""
import math

import bpy
import bmesh
from mathutils import Matrix, Vector


def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def _obj(name, mesh, collection, mats):
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for m in mats if isinstance(mats, (list, tuple)) else [mats]:
        if m is not None:
            mesh.materials.append(m)
    return obj


def smooth(obj, angle=35.0):
    for p in obj.data.polygons:
        p.use_smooth = True
    if hasattr(obj.data, "set_sharp_from_angle"):
        obj.data.set_sharp_from_angle(angle=math.radians(angle))
    return obj


def bevel(obj, width=0.003, segments=3, angle=40.0):
    m = obj.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    return obj


def subsurf(obj, levels=2):
    m = obj.modifiers.new("Subsurf", "SUBSURF")
    m.levels = m.render_levels = levels
    return obj


def place(obj, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    obj.location = loc
    obj.rotation_euler = tuple(math.radians(r) for r in rot)
    if scale:
        obj.scale = scale
    return obj


def box(name, size, loc, mat, collection, rot=(0, 0, 0), bev=0.003, seg=3):
    """Box centred on loc in XY, sitting on loc.z (base at z)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], (v.co.z + 0.5) * size[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = _obj(name, me, collection, mat)
    place(obj, loc, rot)
    if bev:
        bevel(obj, bev, seg)
    return smooth(obj)


def cyl(name, r, h, loc, mat, collection, rot=(0, 0, 0), seg=48, r_top=None, bev=0.0, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=r if r_top is None else r_top, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0, 0, h / 2))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = _obj(name, me, collection, mat)
    place(obj, loc, rot)
    if bev:
        bevel(obj, bev, 2)
    return smooth(obj, 50)


def lathe(name, profile, loc, mat, collection, seg=64, rot=(0, 0, 0)):
    """Revolve an (r, z) profile around Z. Profile runs outside-bottom -> rim -> inside-bottom."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=math.radians(360), steps=seg, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = _obj(name, me, collection, mat)
    place(obj, loc, rot)
    return smooth(obj, 60)


def plane(name, size, loc, mat, collection, rot=(0, 0, 0)):
    """Plane in local XY (normal +Z), UVs 0..1."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / size[0] + 0.5, l.vert.co.y / size[1] + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return place(_obj(name, me, collection, mat), loc, rot)


def torus(name, R, r, loc, mat, collection, rot=(0, 0, 0), arc=360.0, seg=48, ring=16):
    bm = bmesh.new()
    n = max(4, int(seg * arc / 360))
    rings = []
    for i in range(n + 1):
        a = math.radians(arc) * i / n
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new(((R + r * math.cos(b)) * c, (R + r * math.cos(b)) * s, r * math.sin(b)))
                      for b in (2 * math.pi * j / ring for j in range(ring))])
    for i in range(n):
        for j in range(ring):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % ring], rings[i + 1][(j + 1) % ring], rings[i + 1][j]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return smooth(place(_obj(name, me, collection, mat), loc, rot), 60)


def tube(name, points, radius, mat, collection, handles="AUTO", res=24):
    """Bevelled bezier through world points (cables, lamp arms)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = handles
    obj = bpy.data.objects.new(name, cu)
    collection.objects.link(obj)
    cu.materials.append(mat)
    return obj


def rounded_slab(name, size, radius, loc, mat, collection, rot=(0, 0, 0), seg=6):
    """Rounded-corner slab (phones, notebooks, cushions)."""
    w, d, h = size
    obj = box(name, (w, d, h), loc, mat, collection, rot, bev=0)
    m = obj.modifiers.new("Round", "BEVEL")
    m.width = min(radius, w / 2.01, d / 2.01)
    m.segments = seg
    m.affect = "VERTICES"
    m2 = obj.modifiers.new("Edge", "BEVEL")
    m2.width = min(h / 3, 0.002)
    m2.segments = 2
    return obj


def join(objs, name):
    """Apply modifiers and join meshes into one object (fewer draw calls for three.js)."""
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for o in objs:
        eval_o = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(eval_o)
        me.transform(o.matrix_world)
        offset = len(mats)
        for m in o.data.materials:
            mats.append(m)
        for p in me.polygons:
            p.material_index += offset
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    first_coll = objs[0].users_collection[0]
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    first_coll.objects.link(obj)
    for m in mats:
        me.materials.append(m)
    return smooth(obj, 40)
