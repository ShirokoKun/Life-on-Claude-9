"""Ivan from the provided rigged GLB (Tripo/Mixamo rig) -> seated at the desk with a timed performance.

    python -I blender/characters/prep_tripo.py blender/assets/characters/ivan_meshy.glb engine/assets/ivan.glb
           [--preview out.png --frame N]

The film timeline (engine/src/shots.js) is the source of truth: voiceover starts at VO_OFFSET seconds;
performance beats below are written in film seconds and match the voiceover lines.
"""
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

import ivan_pose  # noqa: E402

FPS = 24
FILM_S = 32.0
P = "mixamorig:"
HEIGHT = 1.80
CHAIR, SEAT_TOP, KEYS_Y, DESK_TOP = (6.95, 2.60), 0.525, 3.03, 0.75

# beats in film seconds (voiceover + 1.5 s)
BEATS = {
    "lean_in": (11.4, 15.8),      # "hunched over his laptop, typing furiously"
    "read_pause": (16.3, 17.2),   # stops to read what Claude wrote
    "glance": (17.4, 19.8),       # eyes to the dashboard on the second screen
    "pause2": (24.0, 24.8),
    "nod": (27.6, 28.6),          # "because he realized he could"
    "sit_back": (29.0, 32.0),     # a breath, a half smile
}


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    for o in list(bpy.data.objects):
        if o.type == "MESH" and not o.parent:          # stray helper sphere in the export
            bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    root = rig.parent
    mw = rig.matrix_world.copy()
    rig.parent = None
    rig.matrix_world = mw
    if root:
        bpy.data.objects.remove(root, do_unlink=True)
    top = max((rig.matrix_world @ b.tail_local).z for b in rig.data.bones if "HeadTop" in b.name)
    k = HEIGHT / top
    rig.scale = (k, k, k)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for c in rig.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    meshes = [c for c in rig.children if c.type == "MESH"]
    for m in meshes:                                     # one skinned mesh is cheaper in three.js
        m.select_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "Ivan_Body"
    rig.name = "Ivan_Rig"
    mat = body.material_slots[0].material
    mat.name = "Ivan Tripo"
    for img in bpy.data.images:                          # 8K maps are wasted in a browser; 4K holds close-ups
        if img.size[0] > 4096:
            img.scale(4096, 4096)
    rigid_head(rig, body)
    add_glasses(rig, body)
    bake_shading(rig, body)
    return rig, body


def bake_shading(rig, body, samples=96, distance=0.06):
    """A per-vertex colour 'Shade' the engine's skin shader reads (engine/src/skin.js):
    R = ambient occlusion baked in Cycles in the rest pose (the inside of every curl, eye sockets, nostrils, under the
        chin, behind the ears). The Tripo mesh carries none, which is half of why he read as clean clay.
    G = hair mask, from the head's measured landmarks (the mesh is ~3000 fragments and hair and skin share hues in the
        texture, so neither the pieces nor the colours separate them): above the front hairline, above the ears at the
        temples, and the back of the head down to the nape. Soft-edged over ~1 cm.
    B = 1."""
    import numpy as np
    me = body.data
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.device = "CPU"
    if not sc.world:
        sc.world = bpy.data.worlds.new("bake")
    sc.world.light_settings.distance = distance
    attr = me.color_attributes.new("Shade", "FLOAT_COLOR", "POINT")
    me.color_attributes.active_color = attr
    sc.render.bake.target = "VERTEX_COLORS"
    hidden = [o for o in bpy.data.objects if o is not body and o.type == "MESH"]
    for o in hidden:                                  # the glasses must not darken the face
        o.hide_render = True
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.bake(type="AO")
    for o in hidden:
        o.hide_render = False
    n = len(me.vertices)
    c = np.zeros(n * 4, dtype=np.float32)
    attr.data.foreach_get("color", c)
    c = c.reshape(n, 4)
    L = rig.matrix_world @ rig.data.bones[P + "Head"].head_local
    co = np.array([body.matrix_world @ v.co for v in me.vertices])
    z, y = co[:, 2] - L.z, co[:, 1] - L.y                            # relative to the Head bone (see add_glasses)
    s = lambda v, w=0.01: np.clip(v / w + 0.5, 0, 1)                  # a soft step, ~1 cm wide
    # the hairline runs diagonally from the forehead (z +0.108, y -0.078) down and back to above the ear (z +0.070,
    # y -0.019); behind the ears the hair comes down to the nape (z -0.006)
    front = s(z - (0.070 + 0.65 * np.clip(-0.0188 - y, 0, 0.059)))
    back = s(z + 0.006) * s(y - 0.026)
    hair = np.maximum(front, back)
    c[:, 1] = hair
    c[:, 2] = 1.0
    attr.data.foreach_set("color", c.ravel())
    print(f"shade: AO mean {c[:, 0].mean():.3f}  hair verts {(hair > 0.5).sum()}", flush=True)


def add_glasses(rig, body):
    """Round acetate frames (the character sheet, Oct 2026): thick dark rims, a keyhole bridge resting on the nose,
    hinges at the rim's outer edge, temples running straight back to the ear root and hooking down behind the ear.
    Fitted from the face: the nasion (deepest point of the nose bridge) and the eye line. Parented to the head."""
    import bmesh
    import numpy as np
    # Landmarks of ivan_tripo_v3, read off orthographic front and side renders with 1 cm markers, relative to the Head
    # bone. (This face's nose bridge is too shallow and the fringe curls hang too low for a reliable automatic search.)
    #   pupils z +0.0534, ~58 mm apart; nasion (where the bridge rests) y -0.0928; temples in front of the ears +-0.060;
    #   ear root y -0.0098 (just above the ear, where the temple sits), the helix top z +0.0604
    L = rig.matrix_world @ rig.data.bones[P + "Head"].head_local
    f = 1.0                                                                               # scale to another head
    cx, eye_z, ny, half_w = 0.0, L.z + 0.0534, L.y - 0.0928, 0.060
    print(f"glasses: eye z {eye_z:.4f}  nasion y {ny:.4f}  temples +-{half_w:.3f}", flush=True)

    # the frame, in metres (a 39-mm round, slim rims as on the sheet; the lens centres sit on the pupils)
    r_in, rim, depth = 0.0195 * f, 0.0024 * f, 0.0036 * f        # lens radius, rim face width, rim depth (front-back)
    R = r_in + rim
    gap = 2 * (0.0290 * f - R)                                   # between the rims: lens centres 58 mm apart
    plane_y = ny - 0.0030 * f                                    # rim centre plane: the bridge's back rests on the nose
    tilt, wrap = math.radians(7), math.radians(4)                # pantoscopic tilt (bottom in), face-form wrap
    centres = [Vector((cx + sx * (gap / 2 + R), plane_y, eye_z + 0.0015 * f)) for sx in (-1, 1)]

    bm = bmesh.new()

    def lens_frame(c, sx):
        """Lens space -> world: x across, y the lens axis (toward the face), z up; tilted and wrapped."""
        rot = Matrix.Rotation(-sx * wrap, 4, "Z") @ Matrix.Rotation(-tilt, 4, "X")
        return Matrix.Translation(c) @ rot

    def ring(M, segs=72):
        """A round rim: a rounded rectangle (radial x axial) spun about the lens axis."""
        b = 0.0009 * f                                           # edge round-over
        prof2 = [(r_in, -depth / 2 + b), (r_in + b, -depth / 2), (R - b, -depth / 2), (R, -depth / 2 + b),
                 (R, depth / 2 - b), (R - b, depth / 2), (r_in + b, depth / 2), (r_in, depth / 2 - b)]
        rows = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rows.append([bm.verts.new(M @ Vector((r * math.cos(a), ax, r * math.sin(a)))) for r, ax in prof2])
        for i in range(segs):
            A, Bv = rows[i], rows[(i + 1) % segs]
            for j in range(len(prof2)):
                bm.faces.new((A[j], A[(j + 1) % len(prof2)], Bv[(j + 1) % len(prof2)], Bv[j]))

    def sweep(pts, w, h, up=Vector((0, 0, 1))):
        """A bar with a rounded-rectangle section (w across, h tall) along a polyline; ends capped."""
        pts = [Vector(p) for p in pts]
        sec = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
        rows = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            side = t.cross(up).normalized()
            u = side.cross(t).normalized()
            rows.append([bm.verts.new(p + side * a + u * b) for a, b in sec])
        for A, Bv in zip(rows, rows[1:]):
            for j in range(4):
                bm.faces.new((A[j], A[(j + 1) % 4], Bv[(j + 1) % 4], Bv[j]))
        bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])

    Ms = [lens_frame(c, sx) for c, sx in zip(centres, (-1, 1))]
    for M in Ms:
        ring(M)
    # keyhole bridge: an arch from rim to rim over the nose, its back face resting on the nasion
    bz = 0.42 * R
    a0 = Ms[0] @ Vector((R * math.cos(math.radians(22)), 0, R * math.sin(math.radians(22))))
    a1 = Ms[1] @ Vector((-R * math.cos(math.radians(22)), 0, R * math.sin(math.radians(22))))
    arch = [a0.lerp(a1, u) + Vector((0, 0, 0.0032 * f * math.sin(math.pi * u))) for u in np.linspace(0, 1, 9)]
    sweep(arch, 0.0030 * f, 0.0030 * f, up=Vector((0, -1, 0)))
    # hinges and temples: from the rim's outer edge, 10 degrees above the lens centre, straight back to the ear root,
    # then down behind the ear. The temples splay to clear the temples of the head by ~3 mm.
    ear_y = ny + 0.083 * f                                       # the ear root, ~8 cm behind the nasion
    for M, c, sx in zip(Ms, centres, (-1, 1)):
        a = math.radians(8)
        edge = M @ Vector((sx * R * math.cos(a), 0, R * math.sin(a)))
        hinge_back = edge + Vector((sx * 0.0012 * f, 0.0085 * f, 0))
        sweep([edge - Vector((0, 0.0012 * f, 0)), hinge_back], 0.0030 * f, 0.0038 * f)          # endpiece block
        ear = Vector((cx + sx * (half_w + 0.0075 * f), ear_y, eye_z + 0.007 * f))
        hook = [ear + Vector((-sx * 0.0012 * f, 0.010 * f, -0.004 * f)), ear + Vector((-sx * 0.0035 * f, 0.022 * f, -0.016 * f)),
                ear + Vector((-sx * 0.0055 * f, 0.030 * f, -0.030 * f))]
        sweep([hinge_back, hinge_back.lerp(ear, 0.5), ear] + hook, 0.0018 * f, 0.0032 * f)
    me = bpy.data.meshes.new("Ivan_Glasses")
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    frame = bpy.data.objects.new("Ivan_Glasses", me)
    bpy.context.collection.objects.link(frame)
    mat_f = bpy.data.materials.new("Glasses Frame")
    mat_f.use_nodes = True
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.012, 0.009, 0.008, 1)
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.28
    me.materials.append(mat_f)
    mod = frame.modifiers.new("smooth", "WEIGHTED_NORMAL")
    mod.keep_sharp = False
    objs = [frame]
    mat_l = bpy.data.materials.new("Glasses Lens")
    mat_l.use_nodes = True
    bl = mat_l.node_tree.nodes["Principled BSDF"]
    bl.inputs["Transmission Weight"].default_value = 1.0
    bl.inputs["Roughness"].default_value = 0.0
    bl.inputs["IOR"].default_value = 1.02
    for M in Ms:                                                 # the lenses, seated in the rim's groove
        bpy.ops.mesh.primitive_cylinder_add(radius=r_in + 0.0006 * f, depth=0.0010 * f, vertices=72)
        lens = bpy.context.active_object
        lens.matrix_world = M @ Matrix.Rotation(math.pi / 2, 4, "X")
        lens.data.materials.append(mat_l)
        lens.name = "Ivan_GlassesLens"
        objs.append(lens)
    mw = {o: o.matrix_world.copy() for o in objs}
    for o in objs:
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = P + "Head"
        bpy.context.view_layer.update()
        o.matrix_world = mw[o]


# Eye openings of ivan_tripo_v3 (staging, --eyes): the painted lid margins, traced on texture-only orthographic front
# renders at 40 px/mm, relative to the Head bone head (x across, z up; the model faces -Y), in order around the
# opening. The top follows the lower edge of the painted lash line, so the lashes stay on the lid; the bottom is
# traced along the sclera and then lowered up to 1.3 mm (mid-lid) to take in the painted pale waterline, which would
# otherwise stand as a shelf in front of the eyeball. Centres are the painted pupils (55 mm apart, 0.2 mm above the
# glasses' eye line).
EYE_LIDS = {
    "Right": [(-0.0407, 0.0519), (-0.0394, 0.0538), (-0.0382, 0.0542), (-0.0369, 0.0545), (-0.0354, 0.0547),
            (-0.0332, 0.0549), (-0.0307, 0.0549), (-0.0282, 0.0549), (-0.0264, 0.0547), (-0.0249, 0.0544),
            (-0.0237, 0.0539), (-0.0226, 0.0533), (-0.0217, 0.0521), (-0.0224, 0.0510), (-0.0234, 0.0501),
            (-0.0244, 0.0494), (-0.0269, 0.0480), (-0.0294, 0.0473), (-0.0319, 0.0471), (-0.0344, 0.0474),
            (-0.0369, 0.0483), (-0.0387, 0.0494), (-0.0399, 0.0506)],
    "Left": [(0.0169, 0.0523), (0.0181, 0.0531), (0.0193, 0.0538), (0.0211, 0.0546), (0.0231, 0.0550),
           (0.0251, 0.0550), (0.0271, 0.0548), (0.0291, 0.0545), (0.0311, 0.0539), (0.0326, 0.0534),
           (0.0337, 0.0529), (0.0344, 0.0524), (0.0337, 0.0514), (0.0326, 0.0505), (0.0311, 0.0495),
           (0.0286, 0.0485), (0.0261, 0.0481), (0.0236, 0.0482), (0.0211, 0.0488), (0.0193, 0.0498),
           (0.0181, 0.0509)],
}
EYE_CENTRES = {"Right": (-0.0304, 0.0536), "Left": (0.0247, 0.0537)}


def _closed_spline(pts, n=72):
    """Closed Catmull-Rom through the traced points, resampled to n points, then made convex (the cut needs a
    convex opening; a traced almond is convex up to the tracing noise)."""
    import numpy as np
    P = np.array(pts, float)
    out = []
    m = len(P)
    for i in range(m):
        p0, p1, p2, p3 = P[(i - 1) % m], P[i], P[(i + 1) % m], P[(i + 2) % m]
        for t in np.linspace(0, 1, max(2, n // m + 1), endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out = np.array(out)
    # convex hull (monotone chain), counter-clockwise
    pts_ = sorted(map(tuple, out))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts_:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts_):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return np.array(lower[:-1] + upper[:-1])


def _eye_texture(name, r, iris_r, pupil_r, size=2048, seed=5):
    """Sclera, iris and pupil for a sphere UV-mapped by angle from the front pole: the texture's centre is the
    pupil, its radius pi (the back of the eye). sRGB values; iris colours from the painted eyes (warm hazel-brown)."""
    import numpy as np
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx + 0.5) / size - 0.5
    v = (yy + 0.5) / size - 0.5
    th = np.hypot(u, v) * 2 * math.pi                       # angle from the gaze axis
    ph = np.arctan2(v, u)
    th_i, th_p = math.asin(iris_r / r), math.asin(pupil_r / r)
    s = np.clip((th - th_p) / (th_i - th_p), 0, 1)           # 0 at the pupil edge, 1 at the limbus
    # iris: a golden collarette round the pupil, warm brown stroma, a dark limbal ring; radial fibres and crypts
    def lerp(a, b, t):
        return np.array(a)[None, None] * (1 - t[..., None]) + np.array(b)[None, None] * t[..., None]
    col = lerp((150, 104, 52), (118, 80, 48), np.clip(s / 0.35, 0, 1))
    col = np.where((s > 0.35)[..., None], lerp((118, 80, 48), (92, 60, 40), np.clip((s - 0.35) / 0.45, 0, 1)), col)
    col = np.where((s > 0.8)[..., None], lerp((92, 60, 40), (40, 27, 22), np.clip((s - 0.8) / 0.2, 0, 1)), col)
    k = np.arange(1, 90)
    amp = rng.normal(0, 1, len(k)) / np.sqrt(k)
    phase = rng.uniform(0, 2 * math.pi, len(k))
    fib = sum(a * np.sin(kk * ph + p + 2.5 * s) for a, kk, p in zip(amp, k, phase))
    fib = fib / np.abs(fib).max()
    col *= (1 + 0.22 * fib * (0.4 + 0.6 * np.sin(math.pi * np.clip(s, 0, 1))))[..., None]
    ring = np.exp(-((s - 0.33) / 0.05) ** 2)                 # the collarette's ridge
    col *= (1 + 0.18 * ring)[..., None]
    # sclera: warm off-white, greyer and pinker toward the corners, faint vessels from the periphery
    t_sc = np.clip((th - th_i) / math.radians(70), 0, 1)
    scl = lerp((214, 203, 190), (190, 162, 152), t_sc ** 1.3)
    veins = np.zeros_like(th)
    for _ in range(26):
        a0 = rng.uniform(-math.pi, math.pi)
        a = a0 + 0.0
        pts = []
        t_ = math.radians(rng.uniform(75, 95))
        while t_ > th_i + math.radians(rng.uniform(8, 25)):
            pts.append((t_, a))
            t_ -= math.radians(0.8)
            a += rng.normal(0, 0.02)
        for t_, a in pts[::2]:
            px = int((0.5 + 0.5 * (t_ / math.pi) * math.cos(a)) * size)
            py = int((0.5 + 0.5 * (t_ / math.pi) * math.sin(a)) * size)
            veins[max(py - 1, 0):py + 2, max(px - 1, 0):px + 2] = np.maximum(
                veins[max(py - 1, 0):py + 2, max(px - 1, 0):px + 2], np.clip((t_ - th_i) / math.radians(60), 0, 1))
    try:
        from scipy.ndimage import gaussian_filter
        veins = gaussian_filter(veins, 1.2)
    except ImportError:
        pass
    scl = scl * (1 - 0.35 * veins[..., None]) + np.array((170, 70, 60))[None, None] * 0.35 * veins[..., None]
    # limbus: the iris melts into the sclera over ~0.4 mm
    lim = np.clip((th - th_i) / (0.4 / (r * 1000)), 0, 1)[..., None]
    col = np.where((th > th_i)[..., None], col * (1 - lim) + scl * lim, col)
    pupil = np.clip((th - th_p) / math.radians(1.2), 0, 1)[..., None]
    col = col * pupil + np.array((7, 6, 6))[None, None] * (1 - pupil)
    rgba = np.concatenate([np.clip(col / 255.0, 0, 1), np.ones((size, size, 1))], axis=2)
    img = bpy.data.images.new(name, size, size, alpha=False)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())          # row 0 = v 0 (Blender images start bottom-left)
    img.pack()
    return img


def add_eyes(rig, body, radius=0.0105, iris_r=0.0054, pupil_r=0.0019, bulge=0.0005):
    """Real eyeballs in the painted sockets (staging, --eyes). Run after the performance, before export, so the
    acting (which reads the mesh for its head ellipsoid) is untouched.
    1. The mesh is cut exactly along each traced lid opening (EYE_LIDS): vertical planes through the outline's edges
       split the triangles they cross (UVs, weights and the baked Shade interpolate), and the faces inside are removed.
    2. Two spheres, radius 10.5 mm (from the face's scale: painted iris ~10.5 mm wide and 55 mm between the pupils,
       ~0.88 of an average adult's 12 mm eye and 63 mm), a 0.5 mm corneal bulge over the iris, a generated
       sclera/iris/pupil texture and a glossy clear coat. Centred on the painted pupils (x-z); the depth is set by the
       lids over the iris (they stay 0.15 mm clear of the cornea).
    3. The lids are fitted to the eyeball: the skin within 2.5 mm of the opening rolls onto the eyeball's surface (the
       scan's eye was a flat painted plate), any skin the eyeball would poke through is eased out, the crumpled lid
       skin near the opening is relaxed, and the rim is extruded 0.5-1 mm into the eyeball (a lid margin, darker
       Shade) so no gap shows at grazing angles. Custom normals are carried over from the original triangles and
       follow the new surface where it moved. Nothing farther than ~17 mm from an eye centre changes.
    4. Bones mixamorig:LeftEye / mixamorig:RightEye, children of Head, head at the eyeball centre, +Y straight out
       of the eye, +Z up, +X to his right (rest = looking straight ahead); each eyeball is weighted 100% to its bone."""
    import bmesh
    import numpy as np
    me = body.data
    M = rig.matrix_world.inverted() @ body.matrix_world               # body local -> armature space
    assert all(abs(M[i][j] - (i == j)) < 1e-6 for i in range(4) for j in range(4)), "body must sit in armature space"
    Lh = rig.data.bones[P + "Head"].head_local.copy()
    fwd, up = Vector((0, -1, 0)), Vector((0, 0, 1))                    # rest: the model faces -Y
    front_y = Lh.y - 0.066                                              # the face shell over the eyes (the painted eye ~ -0.078)
    deep_y = Lh.y - 0.050                                               # the scan's folds inside the socket (the skin over the eye: front_y)
    # (an inner shell of the scan sits ~14 mm behind the face above the eyes; it is hidden and ignored)

    # -- 1. the openings ---------------------------------------------------------------------------------------
    nl = len(me.loops)
    cn = np.zeros(nl * 3, np.float32)
    me.corner_normals.foreach_get("vector", cn)
    cn = cn.reshape(-1, 3)
    co0 = np.zeros(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co0)
    co0 = co0.reshape(-1, 3)
    tri_v = np.array([[me.loops[i].vertex_index for i in p.loop_indices] for p in me.polygons])   # all triangles
    tri_n = np.array([[cn[i] for i in p.loop_indices] for p in me.polygons])
    tri_p = co0[tri_v]

    bm = bmesh.new()
    bm.from_mesh(me)
    orig = bm.faces.layers.int.new("eye_orig")
    flange_l = bm.faces.layers.int.new("eye_flange")
    pos0 = bm.verts.layers.float_vector.new("eye_pos0")
    roll_l = bm.verts.layers.float.new("eye_roll")
    for f in bm.faces:
        f[orig] = f.index
    for v in bm.verts:
        v[pos0] = v.co
    shade = bm.verts.layers.float_color.get("Shade")
    uvl = bm.loops.layers.uv.active
    eyes = {}
    for side in ("Right", "Left"):
        poly = _closed_spline([(Lh.x + x, Lh.z + z) for x, z in EYE_LIDS[side]])
        a_, b_ = poly, np.roll(poly, -1, 0)
        lo, hi = poly.min(0) - 0.004, poly.max(0) + 0.004
        cand = {f for f in bm.faces if f.calc_center_median().y < front_y + 0.004 and
                lo[0] < f.calc_center_median().x < hi[0] and lo[1] < f.calc_center_median().z < hi[1]}
        for A, B in zip(a_, b_):
            d = B - A
            nrm = Vector((-d[1], 0.0, d[0])).normalized()                # in x-z: the line's normal (y is the view axis)
            pc = Vector((A[0], 0.0, A[1]))
            sb_lo, sb_hi = np.minimum(A, B) - 0.0003, np.maximum(A, B) + 0.0003
            hit = []
            for f in cand:
                if not f.is_valid:
                    continue
                xs = [v.co.x for v in f.verts]
                zs = [v.co.z for v in f.verts]
                if max(xs) < sb_lo[0] or min(xs) > sb_hi[0] or max(zs) < sb_lo[1] or min(zs) > sb_hi[1]:
                    continue
                sd = [(v.co - pc).dot(nrm) for v in f.verts]
                if min(sd) < -1e-7 and max(sd) > 1e-7:
                    hit.append(f)
            if not hit:
                continue
            geom = list(hit) + list({e for f in hit for e in f.edges}) + list({v for f in hit for v in f.verts})
            ret = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-7, plane_co=pc, plane_no=nrm)
            cand |= {g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)}
        cand = {f for f in cand if f.is_valid}

        def inside(x, z, eps=0.0):
            cr = (b_[:, 0] - a_[:, 0]) * (z - a_[:, 1]) - (b_[:, 1] - a_[:, 1]) * (x - a_[:, 0])
            return bool((cr > eps).all())                              # counter-clockwise polygon

        def on_edge(x, z, tol=3e-6):
            ap = np.c_[x - a_[:, 0], z - a_[:, 1]]
            d = b_ - a_
            t = np.clip((ap * d).sum(1) / (d * d).sum(1), 0, 1)
            return float(np.min(np.hypot(*(ap - d * t[:, None]).T))) < tol
        kill = [f for f in bm.faces if f.calc_center_median().y < deep_y and inside(f.calc_center_median().x, f.calc_center_median().z)]
        ys = [f.calc_center_median().y for f in kill]
        print(f"eyes: {side} opening {np.ptp(poly[:, 0]) * 1000:.1f} x {np.ptp(poly[:, 1]) * 1000:.1f} mm, "
              f"{len(kill)} faces of the painted eye removed (y {min(ys):.4f}..{max(ys):.4f})", flush=True)
        surf = np.array([v.co[:] for f in kill if f.calc_center_median().y < front_y for v in f.verts])
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        rim = [e for e in bm.edges if e.is_boundary and all(on_edge(v.co.x, v.co.z) for v in e.verts)
               and all(v.co.y < front_y + 0.004 for v in e.verts)]
        rim_v = {v for e in rim for v in e.verts}
        # the eyeball centre: the painted pupil in x-z, as far forward as the lids over the iris allow
        cx, cz = Lh.x + EYE_CENTRES[side][0], Lh.z + EYE_CENTRES[side][1]
        reach = math.asin(min(0.99, (iris_r + 0.0006) / radius)) + math.radians(20)   # the cornea, gazing 20 deg off
        def need(p):                                                    # how far the skin must stay from the centre
            d2 = math.hypot(p.x - cx, p.z - cz)
            return radius + 0.00015 + (bulge if d2 < radius * math.sin(reach) else 0.0)
        # only the outer skin counts: the scan also has the lids' back surfaces, a shell curving back into the socket
        # from the lid margins (it ends up inside the eyeball, hidden). Outer = not behind other skin seen from the front.
        from mathutils.bvhtree import BVHTree
        bvh = BVHTree.FromBMesh(bm)
        outer = []
        for v in bm.verts:
            p = v.co
            if p.y < deep_y and math.hypot(p.x - cx, p.z - cz) < radius + bulge + 0.001:
                hit = bvh.ray_cast(Vector((p.x, p.y - 0.05, p.z)), Vector((0, 1, 0)), 0.05)
                if hit[0] is None or hit[0].y > p.y - 0.0015:
                    outer.append(v)
        cy = -1.0
        for v in outer:                                                 # the lids over the iris set the depth
            p = v.co
            rr = need(p) ** 2 - (p.x - cx) ** 2 - (p.z - cz) ** 2
            if math.hypot(p.x - cx, p.z - cz) < 0.6 * radius and rr > 0:
                cy = max(cy, p.y + math.sqrt(rr))
        C = Vector((cx, cy, cz))
        # the lids roll onto the eyeball: each vertex near the opening moves onto the eyeball's surface (plus the
        # cornea where it can reach, plus 0.15 mm): all the way at the rim, fading out 2.5 mm from the outline. The
        # weight depends on x-z only, so the scan's hidden inner shell keeps its order behind the skin.
        def dist_outline(x, z):
            ap = np.c_[x - a_[:, 0], z - a_[:, 1]]
            d = b_ - a_
            t = np.clip((ap * d).sum(1) / (d * d).sum(1), 0, 1)
            return float(np.min(np.hypot(*(ap - d * t[:, None]).T)))
        moved = 0
        rim_moves = []
        for v in bm.verts:
            p = v.co
            if p.y > deep_y or math.hypot(p.x - cx, p.z - cz) > radius + 0.004:
                continue
            roll = 0.0025
            dd = dist_outline(p.x, p.z)
            if dd > roll:
                continue
            w = 1 - dd / roll
            w = w * w * (3 - 2 * w)
            rad = p - C
            r0, Rn = rad.length, need(p)
            if r0 >= Rn:
                # outside: straight back (keeps the traced outline) over the iris, turning radial toward the corners,
                # where straight back would fall off the eyeball's silhouette
                d2 = math.hypot(p.x - cx, p.z - cz)
                k = min(1.0, max(0.0, (d2 / Rn - 0.55) / 0.35)) ** 2
                dvec = (Vector((0, 1, 0)) * (1 - k) - rad / r0 * k).normalized()
                bq = 2 * dvec.dot(rad)
                disc = bq * bq - 4 * (r0 * r0 - Rn * Rn)
                if disc >= 0:
                    t = (-bq - math.sqrt(disc)) / 2
                    if t < 0:
                        t = (-bq + math.sqrt(disc)) / 2
                    mv = dvec * t
                else:
                    mv = -rad / r0 * (r0 - Rn)
            else:                                                       # inside the eyeball: out along the radius
                mv = rad / r0 * (Rn - r0)
            v.co = p + mv * w
            v[roll_l] = max(v[roll_l], w)
            moved += 1
            if v in rim_v:
                rim_moves.append(mv.length * (1 if r0 >= Rn else -1))
        print(f"eyes: {side} lids rolled onto the eyeball: rim moved {min(rim_moves) * 1000:+.2f}..{max(rim_moves) * 1000:+.2f} mm "
              f"(+ = in, toward the eye centre), {moved} verts", flush=True)
        # anything of the outer skin still inside the eyeball (the corners curl tighter than a real eye) is eased out
        deficit = [(v.co.copy(), need(v.co) - (v.co - C).length) for v in outer]
        deficit = [(p, d) for p, d in deficit if d > 0]
        if deficit:
            DP = np.array([[p.x, p.z] for p, _ in deficit])
            DD = np.array([d for _, d in deficit])
            moved = 0
            for v in bm.verts:
                p = v.co
                if p.y > deep_y or math.hypot(p.x - cx, p.z - cz) > radius + 0.005:
                    continue
                dist = np.hypot(DP[:, 0] - p.x, DP[:, 1] - p.z)
                w = np.clip(1 - dist / 0.0025, 0, 1)
                push = float(np.max(DD * w * w * (3 - 2 * w)))
                if push > 1e-6:
                    v.co = p + (p - C).normalized() * push
                    moved += 1
            left = [need(v.co) - (v.co - C).length for v in outer]
            print(f"eyes: {side} skin eased out of the eyeball: max {DD.max() * 1000:.2f} mm, {moved} verts; "
                  f"worst remaining {max(left) * 1000:+.2f} mm", flush=True)
        # the scan's lids are crumpled where the plate met them; relax them: Laplacian smoothing over the lid skin
        # within 6 mm of the opening (7.5 mm under it), welded across the scan's split seams; the rim stays put.
        # Round 14 (K02, the director: "pixel breakage" at the lids in close-ups): it was 8 passes at 0.5 over 3 mm,
        # which left folded slivers standing out of the lid as dark shards and a flap past the outer corner; 80
        # passes at 0.9 over 6 mm unfold them (checked from 4 angles at 100 mm and in K02, K06, K20, K29)
        zone = {}
        for v in bm.verts:
            p = v.co
            if p.y > deep_y or math.hypot(p.x - cx, p.z - cz) > radius + 0.005:
                continue
            dd = dist_outline(p.x, p.z)
            reach_ = 0.006 + 0.0015 * min(1.0, max(0.0, (cz - p.z) / 0.004))   # further under the eye (the seam)
            if dd < reach_:
                wz = 1 - dd / reach_
                zone[v] = wz * wz * (3 - 2 * wz)
        key = lambda co: (round(co.x * 2e5), round(co.y * 2e5), round(co.z * 2e5))
        groups = {}
        for v in zone:
            groups.setdefault(key(v.co), []).append(v)
        nbr = {k: set() for k in groups}
        for k, vs in groups.items():
            for v in vs:
                for e in v.link_edges:
                    o = e.other_vert(v)
                    ko = key(o.co)
                    if ko != k:
                        nbr[k].add(ko)
        pos = {k: vs[0].co.copy() for k, vs in groups.items()}
        wgt = {k: max(zone[v] for v in vs) for k, vs in groups.items()}
        on_rim = {k for k, vs in groups.items() if any(v in rim_v for v in vs)}
        outside_pos = {}
        for it in range(80):
            new = {}
            for k, p in pos.items():
                if k in on_rim:
                    continue
                ns = [pos[n] if n in pos else outside_pos.setdefault(n, Vector(n) / 2e5) for n in nbr[k]]
                if not ns:
                    continue
                avg = sum(ns, Vector()) / len(ns)
                q = p.lerp(avg, 0.9 * wgt[k])
                rr = q - C
                if rr.length < need(q):                                 # nothing may sink into the eyeball
                    q = C + rr.normalized() * need(q)
                new[k] = q
            pos.update(new)
        for k, vs in groups.items():
            for v in vs:
                v.co = pos[k]
                v[roll_l] = max(v[roll_l], wgt[k])
        rim_y = np.mean([v.co.y for v in rim_v])
        print(f"eyes: {side} centre ({cx:.4f}, {cy:.4f}, {cz:.4f}); pole {(cy - radius - np.median(surf[:, 1])) * 1000:+.2f} mm "
              f"behind the painted surface, {(cy - radius - rim_y) * 1000:+.2f} mm behind the rim (mean); rim edges {len(rim)}",
              flush=True)
        # lid margin: the rim extruded back into the eyeball
        ext = bmesh.ops.extrude_edge_only(bm, edges=rim)
        new_v = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
        new_f = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace)]
        src = {}
        for nv in new_v:
            for e in nv.link_edges:
                o = e.other_vert(nv)
                if o in rim_v:
                    src[nv] = o
        for nv in new_v:
            d = nv.co - C
            dl = d.length
            nv.co = C + d / dl * min(dl, radius - 0.0004)
            if shade:
                c = nv[shade]
                nv[shade] = (c[0] * 0.35, c[1], c[2], c[3])
        rim_uv = {}
        for v in rim_v:
            for lp in v.link_loops:
                if not lp.face[flange_l] and lp.face not in new_f:
                    rim_uv[v] = lp[uvl].uv.copy()
                    break
        for f in new_f:
            f[flange_l] = 1
            for lp in f.loops:
                s = src.get(lp.vert, lp.vert)
                if s in rim_uv:
                    lp[uvl].uv = rim_uv[s]
        eyes[side] = C
    bm.normal_update()
    bm.verts.index_update()
    bm.faces.index_update()
    bm.to_mesh(me)
    bm.free()

    # custom normals: each corner's normal interpolated from its original triangle; the lid margin takes the
    # normal of the rim vertex it grew from
    co1 = np.zeros(len(me.vertices) * 3, np.float32)
    me.attributes["eye_pos0"].data.foreach_get("vector", co1)          # positions before the corners were eased out
    co1 = co1.reshape(-1, 3)
    o_attr = np.zeros(len(me.polygons), np.int32)
    me.attributes["eye_orig"].data.foreach_get("value", o_attr)
    fl_attr = np.zeros(len(me.polygons), np.int32)
    me.attributes["eye_flange"].data.foreach_get("value", fl_attr)
    lv = np.zeros(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", lv)
    lp_face = np.zeros(len(me.loops), np.int32)
    for p in me.polygons:
        lp_face[p.loop_start:p.loop_start + p.loop_total] = p.index
    o = o_attr[lp_face]
    P_ = co1[lv]
    a, b, c = tri_p[o, 0], tri_p[o, 1], tri_p[o, 2]
    v0, v1, v2 = b - a, c - a, P_ - a
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = d00 * d11 - d01 * d01
    den[den == 0] = 1e-30
    wb = (d11 * d20 - d01 * d21) / den
    wc = (d00 * d21 - d01 * d20) / den
    wa = 1 - wb - wc
    W = np.clip(np.c_[wa, wb, wc], 0, None)
    W /= W.sum(1, keepdims=True)
    N = (tri_n[o] * W[:, :, None]).sum(1)
    # flange corners: the normal of the nearest rim corner (its source vertex, by position along the extrusion)
    fl = fl_attr[lp_face] == 1
    if fl.any():
        ok = ~fl
        from mathutils.kdtree import KDTree
        rim_corners = np.nonzero(ok)[0]
        kd = KDTree(len(rim_corners))
        for i, li in enumerate(rim_corners):
            kd.insert(P_[li], i)
        kd.balance()
        for li in np.nonzero(fl)[0]:
            # the flange's outer verts sit on the rim; inner verts take the normal of the closest rim corner
            _, i, _ = kd.find(P_[li])
            N[li] = N[rim_corners[i]]
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    # where the lids were rolled onto the eyeball, turn the normals with the new surface: the deformed geometry's
    # normals, welded across the scan's split seams (by position), blended in by the roll weight
    rw = np.zeros(len(me.vertices), np.float32)
    me.attributes["eye_roll"].data.foreach_get("value", rw)
    wl = rw[lv]
    if (wl > 0).any():
        co2 = np.zeros(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co2)
        co2 = co2.reshape(-1, 3)
        fn = np.zeros((len(me.polygons), 3))
        for p in me.polygons:
            vs = co2[list(p.vertices)]
            fn[p.index] = np.cross(vs[1] - vs[0], vs[2] - vs[0])          # area-weighted
        key = np.round(co2 / 0.00005).astype(np.int64)
        kid = {}
        vkey = np.array([kid.setdefault(tuple(k), len(kid)) for k in key])
        acc = np.zeros((len(kid), 3))
        lfn = fn[lp_face] * np.sign((fn[lp_face] * N).sum(1, keepdims=True) + 1e-30)   # scan winding is not consistent
        np.add.at(acc, vkey[lv], lfn)
        G = acc[vkey[lv]]
        G /= np.maximum(np.linalg.norm(G, axis=1, keepdims=True), 1e-12)
        sel = wl > 0
        N[sel] = N[sel] * (1 - wl[sel, None]) + G[sel] * wl[sel, None]
        N /= np.linalg.norm(N, axis=1, keepdims=True)
    me.normals_split_custom_set(N.tolist())
    for nm in ("eye_orig", "eye_flange", "eye_pos0", "eye_roll"):
        me.attributes.remove(me.attributes[nm])

    # -- 2. eyeballs and 3. bones ------------------------------------------------------------------------------
    img = _eye_texture("Ivan_Eye", radius, iris_r, pupil_r)
    mat = bpy.data.materials.new("Ivan Eye")
    mat.use_nodes = True
    nt = mat.node_tree
    bs = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.3
    bs.inputs["Coat Weight"].default_value = 1.0
    bs.inputs["Coat Roughness"].default_value = 0.03
    bs.inputs["Coat IOR"].default_value = 1.376
    th_c = math.asin(min(0.99, (iris_r + 0.0006) / radius))            # the cornea spans the iris and its rim
    thetas = np.unique(np.r_[np.linspace(0, th_c, 18), np.linspace(th_c, math.pi, 34)])
    segs = 64
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = rig.data.edit_bones
    for side, C in eyes.items():
        eb = ebs.new(f"{P}{side}Eye")
        eb.head = C
        eb.tail = C + fwd * 0.012
        eb.align_roll(up)
        eb.parent = ebs[P + "Head"]
        eb.use_connect = False
        eb.use_deform = True
    bpy.ops.object.mode_set(mode="OBJECT")
    right = fwd.cross(up)                                               # fwd x up: +X (his left) in rest
    for side, C in eyes.items():
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        rows = []
        for th in thetas:
            s_ = th / th_c
            rho = radius + (bulge * (1 - s_ * s_) ** 2 if s_ < 1 else 0.0)
            if th == 0 or th == thetas[-1]:
                rows.append([bm.verts.new(C + (fwd if th == 0 else -fwd) * rho)])
                continue
            rows.append([bm.verts.new(C + (fwd * math.cos(th) + (right * math.cos(p) + up * math.sin(p)) * math.sin(th)) * rho)
                         for p in np.linspace(0, 2 * math.pi, segs, endpoint=False)])
        def uvof(th, p):
            return (0.5 + 0.5 * th / math.pi * math.cos(p), 0.5 + 0.5 * th / math.pi * math.sin(p))
        phis = np.linspace(0, 2 * math.pi, segs + 1)
        for i in range(len(rows) - 1):
            A, B = rows[i], rows[i + 1]
            for j in range(segs):
                if len(A) == 1:
                    vs, uvs = (A[0], B[j], B[(j + 1) % segs]), (uvof(thetas[i], (phis[j] + phis[j + 1]) / 2),
                                                                  uvof(thetas[i + 1], phis[j]), uvof(thetas[i + 1], phis[j + 1]))
                elif len(B) == 1:
                    vs, uvs = (A[j], B[0], A[(j + 1) % segs]), (uvof(thetas[i], phis[j]),
                                                                  uvof(thetas[i + 1], (phis[j] + phis[j + 1]) / 2), uvof(thetas[i], phis[j + 1]))
                else:
                    vs = (A[j], B[j], B[(j + 1) % segs], A[(j + 1) % segs])
                    uvs = (uvof(thetas[i], phis[j]), uvof(thetas[i + 1], phis[j]), uvof(thetas[i + 1], phis[j + 1]), uvof(thetas[i], phis[j + 1]))
                f = bm.faces.new(vs)
                for lp, t in zip(f.loops, uvs):
                    lp[uv].uv = t
        bm.normal_update()
        for f in bm.faces:                                              # outward
            if f.normal.dot(f.calc_center_median() - C) < 0:
                f.normal_flip()
        em = bpy.data.meshes.new(f"Ivan_Eye_{side}")
        bm.to_mesh(em)
        bm.free()
        em.shade_smooth()
        em.materials.append(mat)
        ob = bpy.data.objects.new(f"Ivan_Eye_{side}", em)
        bpy.context.collection.objects.link(ob)
        ob.parent = rig
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.matrix_basis = Matrix.Identity(4)
        vg = ob.vertex_groups.new(name=f"{P}{side}Eye")
        vg.add(list(range(len(em.vertices))), 1.0, "REPLACE")
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        hl = C - Lh
        print(f"eyes: {P}{side}Eye at Head {tuple(round(x, 4) for x in hl)} (armature space), radius {radius * 1000:.1f} mm", flush=True)
    bpy.context.view_layer.update()
    return eyes


def add_glasses_wire(rig, body):
    """The first frames: thin round wire, fitted for the earlier Ivan. Kept for reference; not used."""
    import bmesh
    import numpy as np
    head = rig.data.bones[P + "Head"]
    hz = (rig.matrix_world @ head.head_local).z
    top = (rig.matrix_world @ head.tail_local).z if head.children == () else max(
        (rig.matrix_world @ b.tail_local).z for b in rig.data.bones if "HeadTop" in b.name)
    co = np.array([body.matrix_world @ v.co for v in body.data.vertices])
    # eye line from the face profile (model faces -Y): the nose tip is the most forward point of the
    # centre line; the bridge of the nose (most recessed point above it) sits at eye height.
    mid = co[(np.abs(co[:, 0]) < 0.006) & (co[:, 2] > hz) & (co[:, 2] < hz + 0.25)]
    bins = {}
    for x, y, z in mid:
        k = round(z / 0.002)
        bins[k] = min(bins.get(k, 9.0), y)
    zs = sorted(bins)
    tip = min(zs, key=lambda k: bins[k] if k * 0.002 < hz + 0.14 else 9.0)
    above = [k for k in zs if tip < k <= tip + 30]                     # up to 6 cm above the tip
    bridge = max(above, key=lambda k: bins[k])
    eye_z = bridge * 0.002 - 0.004
    print("glasses: nose tip z", tip * 0.002, "bridge z", bridge * 0.002, flush=True)
    band = co[np.abs(co[:, 2] - eye_z) < 0.012]
    face_y = band[np.abs(band[:, 0]) < 0.02][:, 1].min()
    sides = band[(band[:, 1] > face_y) & (band[:, 1] < face_y + 0.12)]
    half_w = np.abs(sides[:, 0]).max()                    # head half-width at the eyes (temple to temple)
    f = half_w / 0.075                                    # this head vs an average adult head
    ipd, lens_r, wire = 0.032 * f, 0.0205 * f, 0.0013 * f
    frames = []
    mat_f = bpy.data.materials.new("Glasses Frame")
    mat_f.use_nodes = True
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.016, 0.014, 1)
    mat_f.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.3
    mat_l = bpy.data.materials.new("Glasses Lens")
    mat_l.use_nodes = True
    bl = mat_l.node_tree.nodes["Principled BSDF"]
    bl.inputs["Transmission Weight"].default_value = 1.0
    bl.inputs["Roughness"].default_value = 0.0
    bl.inputs["IOR"].default_value = 1.02
    centres = []
    for sx in (-1, 1):
        x = sx * ipd
        col = band[np.abs(band[:, 0] - x) < 0.01 * f]
        y = col[:, 1].min() - 0.012 * f                  # model faces -Y: the face is the min-y surface
        centres.append((x, y, eye_z))
    for (x, y, z) in centres:
        bpy.ops.mesh.primitive_torus_add(major_radius=lens_r, minor_radius=wire, major_segments=48, minor_segments=8,
                                         location=(x, y, z), rotation=(math.pi / 2, 0, 0))
        frames.append(bpy.context.active_object)
        bpy.ops.mesh.primitive_cylinder_add(radius=lens_r, depth=0.0008, vertices=48, location=(x, y, z),
                                            rotation=(math.pi / 2, 0, 0))
        lens = bpy.context.active_object
        lens.data.materials.append(mat_l)
        lens.name = "Ivan_GlassesLens"
        frames.append(lens)
    (lx, ly, lz), (rx, ry, rz) = centres

    def tube(p0, p1):
        d = Vector(p1) - Vector(p0)
        bpy.ops.mesh.primitive_cylinder_add(radius=wire * 0.85, depth=d.length, vertices=8,
                                            location=(Vector(p0) + Vector(p1)) / 2,
                                            rotation=Vector((0, 0, 1)).rotation_difference(d).to_euler())
        frames.append(bpy.context.active_object)
    tube((lx + lens_r, ly, lz + 0.15 * lens_r), (rx - lens_r, ry, rz + 0.15 * lens_r))      # bridge
    for (x, y, z), sx in zip(centres, (-1, 1)):                                             # temples to the ears
        ear = (sx * (half_w - 0.004), y + 0.014 * f, z + 0.1 * lens_r)
        tube((x + sx * lens_r, y, z + 0.1 * lens_r), ear)
        tube(ear, (ear[0], ear[1] + 0.085 * f, z - 0.012 * f))
    for o in frames:
        if not o.data.materials:
            o.data.materials.append(mat_f)
    for o in frames:
        if o.name.startswith("Ivan_GlassesLens"):
            continue
        o.name = "Ivan_Glasses"
    mw = {o: o.matrix_world.copy() for o in frames}
    for o in frames:
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = P + "Head"
        bpy.context.view_layer.update()
        o.matrix_world = mw[o]


def rigid_head(rig, body):
    """The generated mesh is several pieces (chin, lips, face) with different bone weights, so any
    neck bend tears the mouth open. Everything above the jawline follows the Head bone rigidly,
    blending into the neck over a few centimetres."""
    neck_z = (rig.matrix_world @ rig.data.bones[P + "Neck"].head_local).z
    head_z = (rig.matrix_world @ rig.data.bones[P + "Head"].head_local).z
    lo, hi = neck_z + 0.25 * (head_z - neck_z), neck_z + 0.55 * (head_z - neck_z)
    vg = body.vertex_groups
    hg = vg.get(P + "Head")
    for v in body.data.vertices:
        z = (body.matrix_world @ v.co).z
        if z <= lo:
            continue
        s = min(1.0, (z - lo) / (hi - lo))
        s = s * s * (3 - 2 * s)
        others = [(g.group, g.weight) for g in v.groups if g.group != hg.index]
        cur_h = next((g.weight for g in v.groups if g.group == hg.index), 0.0)
        new_h = max(cur_h, s)
        rest = sum(w for _, w in others)
        for gi, w in others:
            vg[gi].add([v.index], (w / rest) * (1 - new_h) if rest > 0 else 0.0, "REPLACE")
        hg.add([v.index], new_h, "REPLACE")


def seat(rig):
    rig.rotation_mode = "XYZ"                            # glTF import leaves it in quaternion mode
    rig.rotation_euler = (0, 0, math.pi)                 # model faces -Y; the desk is +Y
    bpy.context.view_layer.update()
    cx, cy = CHAIR
    ivan_pose.pose_seated_typing(
        rig,
        hips_world=(cx, cy + 0.07, SEAT_TOP + 0.10),
        keys_left=(cx - 0.085, KEYS_Y, DESK_TOP + 0.03),
        keys_right=(cx + 0.085, KEYS_Y - 0.01, DESK_TOP + 0.03),
        look_at=(cx, 3.24, 0.88),
    )
    # Tripo weights blend the mouth between Neck and Head: keep them nearly co-linear so the
    # face never stretches; the downward look comes from the upper spine instead.
    up = Vector((0, 0, 1))
    fwd = Vector((0, 1, 0))
    ivan_pose.aim(rig, "Spine2", up + fwd * 0.50)
    ivan_pose.aim(rig, "Neck", up + fwd * 0.42)
    ivan_pose.aim(rig, "Head", up + fwd * 0.36)
    for s_, sg in (("Left", 1), ("Right", -1)):           # re-solve the arms after the spine change
        tgt = (cx + (-0.085 if s_ == "Left" else 0.085), KEYS_Y - (0 if s_ == "Left" else 0.01), DESK_TOP + 0.03)
        sh = ivan_pose.world_head(rig, f"{s_}Arm")
        side = Vector((-1, 0, 0)) * sg                   # rig turned to +Y: his left is -X
        pole = sh + side * 0.35 - up * 0.45 - fwd * 0.1
        ivan_pose.two_bone_ik(rig, f"{s_}Arm", f"{s_}ForeArm", tgt, pole)
        ivan_pose.aim(rig, f"{s_}Hand", fwd * 1.0 - up * 0.25 - side * 0.1)


def smooth_pulse(t, a, b):
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2


def perform(rig, frames):
    sc = bpy.context.scene
    sc.frame_set(1)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    base = {pb.name: pb.rotation_quaternion.copy() for pb in rig.pose.bones}
    for pb in rig.pose.bones:                            # hold the seated pose at both ends
        for f in (1, frames):
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("location", frame=f)
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    rnd = random.Random(11)
    sec = lambda f: (f - 1) / FPS
    paused = lambda t: any(a <= t <= b for k, (a, b) in BEATS.items() if k in ("read_pause", "pause2", "sit_back", "nod"))

    def key(pb, f, q):
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=f)

    # fingers: bursts of taps (people type in phrases); the 'furious' line types fastest
    for side in ("Left", "Right"):
        for finger in ("Index", "Middle", "Ring", "Pinky"):
            for j in (1, 2):
                pb = rig.pose.bones.get(f"{P}{side}Hand{finger}{j}")
                if not pb:
                    continue
                b = base[pb.name]
                f = 2 + rnd.randint(0, 5)
                while f < frames - 4:
                    t = sec(f)
                    if paused(t):
                        key(pb, f, b)
                        f += 6
                        continue
                    fast = BEATS["lean_in"][0] <= t <= BEATS["lean_in"][1]
                    burst = rnd.randint(int(FPS * 1.0), int(FPS * (3.5 if fast else 2.4)))
                    step_lo, step_hi = (2, 4) if fast else (3, 6)
                    k = f
                    while k < min(frames - 4, f + burst) and not paused(sec(k)):
                        amt = (0.30 if j == 1 else 0.22) * rnd.uniform(0.55, 1.0)
                        key(pb, k, b @ Quaternion(X, amt))
                        key(pb, k + 1 + (j == 2), b)
                        k += rnd.randint(step_lo, step_hi)
                    f = k + rnd.randint(int(FPS * 0.15), int(FPS * 0.7))
        hand = rig.pose.bones.get(f"{P}{side}Hand")
        fore = rig.pose.bones.get(f"{P}{side}ForeArm")
        for k in range(1, frames + 1, 3):
            t = sec(k)
            w = 0.0 if paused(t) else 1.0
            key(hand, k, base[hand.name] @ Quaternion(X, w * 0.03 * math.sin(k * 0.9 + (side == "Left") * 1.7)))
            key(fore, k, base[fore.name] @ Quaternion(Z, w * 0.012 * math.sin(k * 0.37 + (side == "Left"))))

    sp2 = rig.pose.bones[P + "Spine2"]
    sp1 = rig.pose.bones[P + "Spine1"]
    sp0 = rig.pose.bones[P + "Spine"]
    neck = rig.pose.bones[P + "Neck"]
    head = rig.pose.bones[P + "Head"]
    # reading saccades: the head steps a few millimetres between lines of code, every 0.5-1.5 s
    sac_r = random.Random(23)
    sac, tt = [], 0.0
    while tt < FILM_S + 2:
        sac.append((tt, sac_r.uniform(-0.022, 0.022), sac_r.uniform(-0.012, 0.012)))
        tt += sac_r.uniform(0.5, 1.5)

    def saccade(t):
        i = max(j for j, (t0, _, _) in enumerate(sac) if t0 <= t)
        (t0, y0, p0), (t1, y1, p1) = sac[max(i - 1, 0)], sac[i]
        w = min(1.0, (t - t1) / 0.12)                        # quick 120 ms move, then hold
        w = w * w * (3 - 2 * w)
        return y0 + (y1 - y0) * w, p0 + (p1 - p0) * w

    shoulders = [rig.pose.bones.get(P + n) for n in ("LeftShoulder", "RightShoulder")]
    for k in range(1, frames + 1, 3):                       # shoulders ride the typing rhythm
        t = sec(k)
        for i, sh in enumerate(shoulders):
            if sh:
                e = 0.0 if paused(t) else 1.0
                key(sh, k, base[sh.name] @ Quaternion(Z, e * 0.012 * math.sin(t * 7.3 + i * 2.1) + 0.006 * math.sin(t * 0.7 + i)))
    for k in range(1, frames + 1, 2):
        t = sec(k)
        breath = math.sin(2 * math.pi * 0.26 * t)
        sway = 0.016 * math.sin(2 * math.pi * t / 6.5) + 0.006 * math.sin(2 * math.pi * t / 2.9 + 1.0)
        roll = 0.008 * math.sin(2 * math.pi * t / 8.3 + 0.5)
        lean = 0.08 * smooth_pulse(t, *BEATS["lean_in"])
        back = -0.10 * min(1.0, max(0.0, (t - BEATS["sit_back"][0]) / 1.6))
        key(sp0, k, base[sp0.name] @ Quaternion(X, 0.6 * (lean + back)))
        key(sp1, k, base[sp1.name] @ Quaternion(X, lean + back))
        key(sp2, k, base[sp2.name] @ Quaternion(X, -0.012 * breath + 0.5 * lean) @ Quaternion(Y, sway) @ Quaternion(Z, roll))
        yaw = -0.30 * smooth_pulse(t, *BEATS["glance"])           # toward the second screen (his right)
        nod = 0.10 * smooth_pulse(t, *BEATS["nod"]) - 0.06 * smooth_pulse(t, *BEATS["read_pause"])
        drift = 0.012 * math.sin(t * 1.1) + 0.008 * math.sin(t * 2.9)
        key(neck, k, base[neck.name] @ Quaternion(Y, 0.4 * yaw))
        sy, sp = saccade(t)
        key(head, k, base[head.name] @ Quaternion(Y, 0.6 * yaw + sy - 0.5 * sway) @ Quaternion(X, nod + drift + sp - 0.6 * back))


def export(rig, out, frames):
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, frames
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_animations=True, export_skins=True,
                              export_force_sampling=True, export_frame_range=True, export_morph=False,
                              export_image_format="JPEG", export_jpeg_quality=92, export_yup=True,
                              export_vertex_color="NAME", export_vertex_color_name="Shade")
    print("EXPORTED", out, Path(out).stat().st_size / 1e6, "MB", flush=True)


if __name__ == "__main__":
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]   # blender -b -P prep_tripo.py -- ...
    rig, body = load(a[0])
    if "--stand" in a:                                # standing still at x,y facing +Y (scene 2, the doorway)
        import acting
        x, y = (float(v) for v in a[a.index("--stand") + 1].split(","))
        frames = int(float(a[a.index("--seconds") + 1]) * FPS) if "--seconds" in a else 10 * FPS
        rig.rotation_mode = "XYZ"
        rig.rotation_euler = (0, 0, math.pi)
        bpy.context.view_layer.update()
        hips = rig.matrix_world @ rig.pose.bones["mixamorig:Hips"].head
        feet = min((rig.matrix_world @ pb.tail).z for pb in rig.pose.bones if "Toe" in pb.name or "Foot" in pb.name)
        rig.location = (rig.location.x + x - hips.x, rig.location.y + y - hips.y, rig.location.z - feet + 0.01)
        bpy.context.view_layer.update()
        actor = acting.Actor(rig, body)
        actor.calibrate()
        actor.reset_upper()
        actor.calibrate_fingers()
        actor.perform_stand(frames, Vector((x, y + 6.0, 1.75)))
        if "--eyes" in a:                             # staging: real eyeballs and eye bones (after the performance)
            add_eyes(rig, body)
        if "--blend" in a:
            bpy.ops.wm.save_as_mainfile(filepath=a[a.index("--blend") + 1])
        export(rig, a[1], frames)
        sys.exit(0)
    seat(rig)
    if "--v1" in a:                                   # intro v1 (32 s, layered performance)
        frames = int(FILM_S * FPS)
        perform(rig, frames)
    else:                                             # intro v2: per-frame acting (acting.py), 37 s
        import acting
        frames = int((float(a[a.index("--seconds") + 1]) if "--seconds" in a else 37.0) * FPS)
        actor = acting.Actor(rig, body, acting.SCENES[a[a.index("--scene") + 1]] if "--scene" in a else None)
        actor.fast(True)
        actor.calibrate()
        actor.reset_upper()
        actor.posture(0.55, 0.0)
        actor.shoulders(0.0)
        for side, home in (("Left", acting.HOME_L), ("Right", acting.HOME_R)):
            actor.arm_to(side, home)
        actor.calibrate_fingers()
        if "--frames" in a:
            frames = int(a[a.index("--frames") + 1])
        actor.perform(frames)
        if "--events" in a:                        # keystrokes for the engine's live screens
            import json
            with open(a[a.index("--events") + 1], "w") as fh:
                json.dump({"fps": FPS, "keys": [[round(t, 3), s[0], f[0]] for t, s, f in actor.events],
                           "typing": actor.sc["typing"], "gaze": actor.sc["gaze"]}, fh)
    if "--eyes" in a:                                 # staging: real eyeballs and eye bones (after the performance)
        add_eyes(rig, body)
    if "--blend" in a:
        bpy.ops.wm.save_as_mainfile(filepath=a[a.index("--blend") + 1])
    export(rig, a[1], frames)
