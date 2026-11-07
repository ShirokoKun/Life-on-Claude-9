"""Office props for the tutorial-room rebuild: scripted hard surface where geometry is simple (monitors, tower, keyboard,
books, boxes, bags), Poly Haven where photoscans beat us (lamps, notepads, tools, laptop junk).
Every builder: real metres, bevelled edges, materials with wear. Toys are original designs."""
import bpy, math, random, os
from mathutils import Vector, Euler
import room_kit as K

R = random.Random(11)
ROOM_ASSETS = os.path.join(K.ROOT, 'blender', 'assets', 'room')

def _m():
    return {
        'bp': K.mat_plain('black_plastic', (0.025, 0.025, 0.027), rough=0.45, bump=0.05, bump_scale=400),
        'bp_satin': K.mat_plain('black_satin', (0.03, 0.03, 0.032), rough=0.32, coat=0.2),
        'screen_off': K.mat_plain('screen_off', (0.008, 0.008, 0.01), rough=0.08, coat=0.8, spec=0.6),
        'screen_on': K.mat_image_emit('screen_ui', os.path.join(ROOM_ASSETS, 'screen_ui.png'), 1.4),
        'key': K.mat_plain('keycap', (0.035, 0.035, 0.038), rough=0.55, bump=0.05, bump_scale=600),
        'silver': K.mat_plain('silver_alu', (0.62, 0.63, 0.64), rough=0.3, metal=1.0, bump=0.02, bump_scale=300),
        'ceramic_beige': K.mat_plain('ceramic_beige', (0.78, 0.74, 0.66), rough=0.18, coat=0.5),
        'ceramic_white': K.mat_plain('ceramic_white', (0.86, 0.86, 0.84), rough=0.15, coat=0.5),
        'tea': K.mat_plain('tea', (0.18, 0.08, 0.02), rough=0.02, coat=1.0),
        'red_card': K.mat_plain('red_card', (0.55, 0.06, 0.04), rough=0.6, bump=0.05, bump_scale=200),
        'kraft': K.mat_tex('kraft', 'cardboard', tile=0.4, tint=(1.0, 0.9, 0.78), rough_mul=0.3, rough_add=0.6, normal=0.6),
        'cork': K.mat_tex('cork', 'cork', tile=0.3, rough_mul=0.3, rough_add=0.6),
        'paper': K.mat_tex('paper', 'paper', tile=0.25, tint=(0.95, 0.94, 0.9), rough_mul=0.2, rough_add=0.7, normal=0.3),
        'navy_fabric': K.mat_tex('navy_fabric', 'fabric_weave', tile=0.12, tint=(0.18, 0.28, 0.65), rough_mul=0.3, rough_add=0.65, normal=0.8),
        'ivory': K.mat_plain('ivory_plastic', (0.83, 0.8, 0.7), rough=0.38, coat=0.2),
        'red_vinyl': K.mat_plain('red_vinyl', (0.5, 0.04, 0.03), rough=0.32, coat=0.4),
        'chrome': K.mat_plain('chrome', (0.8, 0.8, 0.8), rough=0.12, metal=1.0),
        'gunmetal': K.mat_plain('gunmetal', (0.25, 0.26, 0.28), rough=0.35, metal=1.0),
        'green_glass': K.mat_glass('green_bottle', rough=0.05, tint=(0.45, 0.62, 0.35)),
        'clear_plastic': K.mat_glass('frosted_box', rough=0.55, tint=(0.75, 0.8, 0.86)),
        'label': K.mat_plain('label_white', (0.85, 0.85, 0.82), rough=0.6),
        'can_red': K.mat_plain('can_red', (0.6, 0.05, 0.05), rough=0.25, metal=0.6, coat=0.3),
        'rubber': K.mat_plain('rubber', (0.02, 0.02, 0.02), rough=0.8),
    }

# ---------------------------------------------------------------- the workstation
def monitor(name, loc, rz, on, M, size=(0.6, 0.36)):
    g = bpy.data.objects.new(name, None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    w, h = size; zc = 0.13 + h / 2 + 0.03
    for o in (K.cube(name + '_bezel', (w, 0.022, h), (0, 0, zc), M['bp_satin'], bev=0.004),
              K.cube(name + '_back', (w * 0.6, 0.04, h * 0.6), (0, 0.03, zc), M['bp'], bev=0.01),
              K.cube(name + '_screen', (w - 0.016, 0.002, h - 0.022), (0, -0.0115, zc + 0.003), M['screen_on'] if on else M['screen_off'], bev=0),
              K.cube(name + '_neck', (0.05, 0.03, zc - 0.02), (0, 0.06, (zc - 0.02) / 2), M['bp'], bev=0.006),
              K.cube(name + '_foot', (0.24, 0.19, 0.012), (0, 0.04, 0.006), M['bp'], bev=0.004)):
        o.parent = g
    return g

def pc_tower(loc, rz, M):
    g = bpy.data.objects.new('pc', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    parts = [K.cube('pc_case', (0.2, 0.44, 0.44), (0, 0, 0.22), M['bp'], bev=0.006),
             K.cube('pc_front', (0.2, 0.01, 0.44), (0, -0.224, 0.22), M['bp_satin'], bev=0.004),
             K.cyl('pc_power', 0.008, 0.004, (0.05, -0.23, 0.4), M['chrome'], rot=(90, 0, 0), seg=16),
             K.cube('pc_drive', (0.15, 0.004, 0.045), (0, -0.23, 0.36), M['bp'], bev=0.001)]
    for k in range(6): parts.append(K.cube('pc_vent', (0.12, 0.003, 0.006), (0, -0.23, 0.08 + k * 0.014), M['bp'], bev=0))
    for p in parts: p.parent = g
    return g

def keyboard(loc, rz, M):
    g = bpy.data.objects.new('keyboard', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    base = K.cube('kb_base', (0.44, 0.14, 0.018), (0, 0, 0.012), M['bp'], bev=0.004); base.parent = g
    import bmesh
    me = bpy.data.meshes.new('keys'); bm = bmesh.new()
    rows = [(15, 0.0), (15, 0.0), (14, 0.012), (13, 0.018), (12, 0.026)]
    for r_, (n, off) in enumerate(rows):
        for k in range(n):
            ret = bmesh.ops.create_cube(bm, size=1.0)
            for v in ret['verts']:
                v.co = Vector((v.co.x * 0.0165 + (-0.205 + off + k * 0.019), v.co.y * 0.0165 + (0.045 - r_ * 0.019), v.co.z * 0.008 + 0.024))
    ret = bmesh.ops.create_cube(bm, size=1.0)
    for v in ret['verts']: v.co = Vector((v.co.x * 0.11, v.co.y * 0.0165 - 0.05, v.co.z * 0.008 + 0.024))   # the space bar
    bm.to_mesh(me); bm.free()
    keys = bpy.data.objects.new('kb_keys', me); K.link(keys); me.materials.append(M['key']); keys.parent = g
    K.bevel(keys, 0.002, 2)
    return g

def mouse(loc, rz, M):
    o = K.cube('mouse', (0.06, 0.105, 0.035), (loc[0], loc[1], loc[2] + 0.018), M['bp_satin'], bev=0.0, rot=(0, 0, rz))
    b = o.modifiers.new('r', 'BEVEL'); b.width = 0.02; b.segments = 4; K.subsurf(o, 2)
    pad = K.cube('mousepad', (0.26, 0.22, 0.003), (loc[0], loc[1], loc[2] + 0.0015), M['rubber'], bev=0.001, rot=(0, 0, rz - 4))
    return o

def mug(name, loc, M, mat='ceramic_beige', tea=True):
    prof = [(0.0, 0.0), (0.038, 0.0), (0.04, 0.004), (0.041, 0.09), (0.043, 0.098), (0.039, 0.098), (0.036, 0.094), (0.036, 0.008), (0.0, 0.008)]
    o = K.lathe(name, prof, loc, M[mat]); K.subsurf(o, 1)
    h = K.cube(name + '_handle', (0.012, 0.045, 0.06), (loc[0] + 0.048, loc[1], loc[2] + 0.05), M[mat], bev=0.0)
    hb = h.modifiers.new('r', 'BEVEL'); hb.width = 0.006; hb.segments = 3
    if tea: K.cyl(name + '_tea', 0.0355, 0.002, (loc[0], loc[1], loc[2] + 0.07), M['tea'], seg=32, bev=0)
    return o

def glass_cup(loc, M):
    prof = [(0.0, 0.0), (0.033, 0.0), (0.036, 0.11), (0.034, 0.11), (0.031, 0.004), (0.0, 0.004)]
    o = K.lathe('glass_cup', prof, loc, K.mat_glass('glass_clear')); K.cyl('glass_tea', 0.032, 0.06, (loc[0], loc[1], loc[2] + 0.034), M['tea'], seg=32, bev=0)
    return o

def bottle(name, loc, M, kind='tea'):
    if kind == 'tea':
        prof = [(0, 0), (0.03, 0), (0.032, 0.01), (0.032, 0.15), (0.026, 0.18), (0.014, 0.2), (0.014, 0.215), (0, 0.215)]
        o = K.lathe(name, prof, loc, M['green_glass']); K.cyl(name + '_cap', 0.0155, 0.02, (loc[0], loc[1], loc[2] + 0.222), M['ceramic_white'], seg=24)
        K.cyl(name + '_label', 0.0325, 0.07, (loc[0], loc[1], loc[2] + 0.08), K.mat_plain('label_green', (0.3, 0.5, 0.25), rough=0.5), seg=32, bev=0)
    else:
        prof = [(0, 0), (0.022, 0), (0.024, 0.01), (0.024, 0.11), (0.012, 0.13), (0, 0.13)]
        o = K.lathe(name, prof, loc, M['ceramic_white']); K.cyl(name + '_cap', 0.01, 0.02, (loc[0], loc[1], loc[2] + 0.14), M['bp'], seg=16)
    return o

def can(loc, M):
    return K.cyl('can', 0.033, 0.122, (loc[0], loc[1], loc[2] + 0.061), M['can_red'], seg=32, bev=0.003)

def red_box(loc, rz, M):
    return K.cube('red_box', (0.12, 0.12, 0.09), (loc[0], loc[1], loc[2] + 0.045), M['red_card'], bev=0.003, rot=(0, 0, rz))

def cork_board(loc, rz, M):
    g = bpy.data.objects.new('cork_board', None); K.link(g); g.location = loc; g.rotation_euler = Euler((math.radians(-8), 0, math.radians(rz)))
    for o in (K.cube('cork_frame', (0.62, 0.025, 0.46), (0, 0, 0.23), K.mat_tex('frame_wood', 'light_wood', tile=0.4), bev=0.003),
              K.cube('cork_face', (0.58, 0.026, 0.42), (0, -0.001, 0.23), M['cork'], bev=0)):
        o.parent = g
    for (x, z, w, h) in ((-0.17, 0.3, 0.16, 0.2), (0.05, 0.27, 0.18, 0.24), (0.2, 0.33, 0.1, 0.12), (-0.05, 0.1, 0.12, 0.08)):
        p = K.cube('pinned', (w, 0.002, h), (x, -0.015, z), M['paper'], bev=0, rot=(0, R.uniform(-4, 4), 0)); p.parent = g
        pin = K.cyl('pin', 0.004, 0.006, (x, -0.018, z + h / 2 - 0.015), M['can_red'], rot=(90, 0, 0), seg=12, bev=0); pin.parent = g
    return g

def book(name, size, loc, rz, color, M, rx=0):
    """A book: a coloured cover shell and an inset ivory page block."""
    w, d, h = size   # thickness, depth, height
    g = bpy.data.objects.new(name, None); K.link(g); g.location = loc; g.rotation_euler = Euler((math.radians(rx), 0, math.radians(rz)))
    cov = K.mat_plain(f'cover_{color}', color, rough=0.55, bump=0.08, bump_scale=120)
    c = K.cube(name + '_cover', (w, d, h), (0, 0, h / 2), cov, bev=0.0015); c.parent = g
    p = K.cube(name + '_pages', (w - 0.004, d - 0.002, h - 0.006), (0, -0.003, h / 2), K.mat_plain('pages', (0.86, 0.83, 0.74), rough=0.8, bump=0.1, bump_scale=900), bev=0.0005); p.parent = g
    return g

BOOK_COLS = [(0.6, 0.12, 0.08), (0.08, 0.15, 0.35), (0.85, 0.8, 0.7), (0.12, 0.12, 0.12), (0.75, 0.55, 0.15), (0.2, 0.35, 0.25), (0.9, 0.9, 0.88), (0.45, 0.08, 0.1), (0.3, 0.3, 0.32)]
def book_stack(loc, n, M, rz=0):
    z = loc[2]
    for k in range(n):
        w, d = R.uniform(0.15, 0.22), R.uniform(0.21, 0.3); t = R.uniform(0.015, 0.04)
        book(f'stack_book{k}', (d, w, t), (loc[0] + R.uniform(-0.012, 0.012), loc[1] + R.uniform(-0.012, 0.012), z), rz + R.uniform(-8, 8), R.choice(BOOK_COLS), M, rx=0)
        # lying flat: the 'height' axis is the thickness here
        z += t

def book_row(x0, y, z, length, M, axis='x', rz=0):
    """Books standing on a shelf, spines out."""
    a = 0.0
    while a < length - 0.03:
        t = R.uniform(0.015, 0.045); h = R.uniform(0.18, 0.27); d = R.uniform(0.13, 0.2)
        lean = R.uniform(-3, 3) if R.random() > 0.85 else 0
        if axis == 'x': book('shelf_book', (t, d, h), (x0 + a + t / 2, y, z), rz, R.choice(BOOK_COLS), M)
        else: book('shelf_book', (t, d, h), (x0, y + a + t / 2, z), rz + 90, R.choice(BOOK_COLS), M)
        a += t + 0.001

def paper_stack(loc, n, M, rz=0, size=(0.3, 0.22)):
    """Loose sheets and magazines piled with small offsets (the mess has layers)."""
    z = loc[2]
    for k in range(n):
        th = R.choice((0.0015, 0.0015, 0.004, 0.006))
        K.cube('paper_sheet', (size[0] * R.uniform(0.9, 1.05), size[1] * R.uniform(0.9, 1.05), th), (loc[0] + R.uniform(-0.02, 0.02), loc[1] + R.uniform(-0.02, 0.02), z + th / 2),
               M['paper'] if R.random() > 0.25 else K.mat_plain(f'mag{k % 3}', R.choice(BOOK_COLS), rough=0.35), bev=0.0, rot=(0, 0, rz + R.uniform(-9, 9)))
        z += th

# ---------------------------------------------------------------- lamps
def gooseneck_lamp(loc, rz, M):
    g = bpy.data.objects.new('goose_lamp', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    parts = [K.cyl('gl_base', 0.075, 0.025, (0, 0, 0.0125), M['ivory'], seg=40, bev=0.006)]
    pts = [(0, 0, 0.02), (0, 0.0, 0.18), (0.02, -0.05, 0.33), (0.08, -0.14, 0.4), (0.16, -0.2, 0.38)]
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b); d = b - a
        c = K.cyl('gl_neck', 0.008, d.length, (a + b) / 2, M['ivory'], seg=10, bev=0)
        c.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); parts.append(c)
    shade = K.lathe('gl_shade', [(0.0, 0.0), (0.03, 0.0), (0.07, -0.05), (0.068, -0.052), (0.028, -0.004), (0.0, -0.004)], (0.16, -0.2, 0.4), M['ivory'], rot=(25, 0, 0))
    parts.append(shade)
    for p in parts: p.parent = g
    return g

# ---------------------------------------------------------------- floor life
def paper_bag(loc, rz, M, h=0.32):
    g = bpy.data.objects.new('paper_bag', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    body = K.cube('bag_body', (0.26, 0.14, h), (0, 0, h / 2), M['kraft'], bev=0.0)
    sol = body.modifiers.new('open', 'SOLIDIFY'); sol.thickness = 0.002
    import bmesh
    bm = bmesh.new(); bm.from_mesh(body.data)
    top = [f for f in bm.faces if f.normal.z > 0.9]; bmesh.ops.delete(bm, geom=top, context='FACES')
    for v in bm.verts:   # crumple: the sides bow and the top edge sags a little
        v.co.x += (R.random() - 0.5) * 0.008; v.co.y += (R.random() - 0.5) * 0.008
    bm.to_mesh(body.data); bm.free()
    sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    disp = body.modifiers.new('crumple', 'DISPLACE'); tex = bpy.data.textures.new('crumple', 'CLOUDS'); tex.noise_scale = 0.06; disp.texture = tex; disp.strength = 0.012
    body.parent = g
    for s in (-1, 1):
        hd = K.cyl('bag_handle', 0.003, 0.18, (s * 0.06, 0, h + 0.05), M['kraft'], rot=(0, 90, 0), seg=6, bev=0); hd.parent = g
    return g

def cooler_bag(loc, rz, M):
    g = bpy.data.objects.new('cooler_bag', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    b = K.cube('cooler_body', (0.42, 0.28, 0.28), (0, 0, 0.15), M['navy_fabric'], bev=0.0)
    bv = b.modifiers.new('r', 'BEVEL'); bv.width = 0.05; bv.segments = 4; K.subsurf(b, 1); b.parent = g
    for o in (K.cube('cooler_zip', (0.38, 0.006, 0.006), (0, -0.14, 0.27), M['bp'], bev=0.001),
              K.cube('cooler_pocket', (0.3, 0.04, 0.14), (0, -0.155, 0.12), M['navy_fabric'], bev=0.015),
              K.cube('cooler_strap', (0.04, 0.3, 0.004), (0, 0, 0.3), M['bp'], bev=0.001)):
        o.parent = g
    return g

def stick_vacuum(loc, rz, M):
    """Leaning against the wall: handle and motor at the top, a long tube, the floor head."""
    g = bpy.data.objects.new('vacuum', None); K.link(g); g.location = loc; g.rotation_euler = Euler((math.radians(-12), 0, math.radians(rz)))
    parts = [K.cube('vac_head', (0.26, 0.09, 0.05), (0, -0.03, 0.025), M['ivory'], bev=0.012),
             K.cyl('vac_tube', 0.016, 0.72, (0, 0, 0.42), M['ivory'], seg=16),
             K.cyl('vac_motor', 0.05, 0.24, (0, 0.02, 0.9), M['ivory'], seg=24, bev=0.01),
             K.cyl('vac_bin', 0.045, 0.12, (0, -0.05, 0.86), M['clear_plastic'], seg=24, rot=(0, 0, 0)),
             K.cube('vac_handle', (0.03, 0.12, 0.03), (0, 0.03, 1.07), M['ivory'], bev=0.012),
             K.cube('vac_grip', (0.03, 0.03, 0.12), (0, 0.08, 1.01), M['ivory'], bev=0.012)]
    for p in parts: p.parent = g
    return g

def waste_basket(loc, M):
    o = K.lathe('basket', [(0.0, 0.0), (0.12, 0.0), (0.15, 0.3), (0.145, 0.3), (0.115, 0.006), (0.0, 0.006)], loc, M['bp'])
    for k in range(5):   # crumpled paper inside and spilling
        p = K.cube('crumple', (0.07, 0.07, 0.07), (loc[0] + R.uniform(-0.06, 0.06), loc[1] + R.uniform(-0.06, 0.06), loc[2] + 0.22 + k * 0.025), M['paper'], bev=0)
        K.subsurf(p, 2); d = p.modifiers.new('crumple', 'DISPLACE'); t = bpy.data.textures.new('cr', 'CLOUDS'); t.noise_scale = 0.02; d.texture = t; d.strength = 0.02
    return o

def storage_box(loc, rz, M, size=(0.42, 0.3, 0.18)):
    b = K.cube('storage_box', size, (loc[0], loc[1], loc[2] + size[2] / 2), K.mat_plain('box_plastic', (0.72, 0.76, 0.8), rough=0.45, transmission=0.0), bev=0.01, rot=(0, 0, rz))
    K.cube('storage_lid', (size[0] + 0.01, size[1] + 0.01, 0.02), (loc[0], loc[1], loc[2] + size[2] + 0.01), K.mat_plain('lid_blue', (0.25, 0.38, 0.55), rough=0.4), bev=0.006, rot=(0, 0, rz))
    for k in range(3):   # things inside
        K.cube('box_inside', (0.1, 0.08, 0.06), (loc[0] + R.uniform(-0.12, 0.12), loc[1] + R.uniform(-0.08, 0.08), loc[2] + 0.04), K.mat_plain(f'inside{k}', R.choice(BOOK_COLS), rough=0.5), bev=0.004, rot=(0, 0, R.uniform(0, 90)))
    return b

def cable(name, pts, M, r=0.003):
    """A cable through points (Catmull-Rom sampled, so it sags and curves smoothly)."""
    P = [Vector(p) for p in pts]; out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for t in [k / 8 for k in range(8)]:
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(out) - 1)
    for p, co in zip(sp.points, out): p.co = (co.x, co.y, co.z, 1)
    o = bpy.data.objects.new(name, cu); K.link(o); cu.materials.append(M['bp'])
    return o

# ---------------------------------------------------------------- toys (original designs)
def red_bear_toy(loc, rz, M):
    """A chunky red vinyl bear (an original collectible): round head, ears, stubby body."""
    g = bpy.data.objects.new('toy_bear', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    def ball(n, r, at, s=(1, 1, 1), mat=M['red_vinyl']):
        o = K.cyl(n, r, r * 2, at, mat, seg=24, bev=0); o.scale = s
        b = o.modifiers.new('r', 'BEVEL'); b.width = r * 0.9; b.segments = 4; K.subsurf(o, 1); o.parent = g; return o
    ball('bear_body', 0.035, (0, 0, 0.045), (1, 0.85, 1.1)); ball('bear_head', 0.033, (0, 0, 0.115))
    for s in (-1, 1):
        ball('bear_ear', 0.012, (s * 0.026, 0, 0.15)); ball('bear_arm', 0.012, (s * 0.04, -0.005, 0.06), (1, 1, 1.6)); ball('bear_leg', 0.014, (s * 0.018, -0.01, 0.012))
        e = K.cyl('bear_eye', 0.004, 0.003, (s * 0.012, -0.031, 0.12), M['bp_satin'], rot=(90, 0, 0), seg=12, bev=0); e.parent = g
    return g

def robot_figure(loc, rz, M):
    """A small articulated silver robot figure on a black stand (an original design)."""
    g = bpy.data.objects.new('robot', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    P = [K.cyl('rb_stand', 0.035, 0.008, (0, 0, 0.004), M['bp'], seg=24),
         K.cube('rb_pelvis', (0.03, 0.02, 0.02), (0, 0, 0.075), M['gunmetal'], bev=0.003),
         K.cube('rb_torso', (0.045, 0.028, 0.05), (0, 0, 0.115), M['silver'], bev=0.006),
         K.cube('rb_head', (0.022, 0.022, 0.022), (0, 0, 0.155), M['silver'], bev=0.005),
         K.cube('rb_visor', (0.016, 0.003, 0.005), (0, -0.0115, 0.157), K.mat_emit('visor', (1.0, 0.3, 0.1), 3.0), bev=0)]
    for s in (-1, 1):
        P += [K.cyl('rb_leg', 0.007, 0.065, (s * 0.01, 0, 0.04), M['gunmetal'], seg=10),
              K.cyl('rb_arm', 0.006, 0.055, (s * 0.03, 0, 0.11), M['silver'], seg=10, rot=(0, s * 12, 0))]
    for p in P: p.parent = g
    return g

def laptop(loc, rz, M, open_deg=112):
    """A modern silver laptop, lid open, screen off (a black mirror catching the window)."""
    g = bpy.data.objects.new('laptop', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    P_ = [K.cube('lap_base', (0.33, 0.23, 0.016), (0, 0, 0.008), M['silver'], bev=0.004, seg=3),
          K.cube('lap_keys', (0.28, 0.1, 0.002), (0, 0.035, 0.0165), M['key'], bev=0),
          K.cube('lap_pad', (0.11, 0.065, 0.001), (0, -0.065, 0.0162), K.mat_plain('pad', (0.5, 0.51, 0.52), rough=0.25, metal=0.8), bev=0)]
    lid = bpy.data.objects.new('lap_lid', None); K.link(lid); lid.parent = g; lid.location = (0, 0.115, 0.016)
    lid.rotation_euler = Euler((math.radians(-(180 - open_deg)), 0, 0)) if False else Euler((math.radians(open_deg - 90 - 90 + 90), 0, 0))
    a = K.cube('lap_lid_shell', (0.33, 0.006, 0.22), (0, 0, 0.11), M['silver'], bev=0.003); a.parent = lid
    b = K.cube('lap_screen', (0.3, 0.001, 0.19), (0, -0.0035, 0.115), M['screen_off'], bev=0); b.parent = lid
    lid.rotation_euler = Euler((math.radians(-(open_deg - 90)), 0, 0))
    for p in P_: p.parent = g
    return g

def architect_lamp(loc, rz, M):
    """The black desk lamp: round weighted base, two arms with springs, a deep dome shade with a bulb inside."""
    g = bpy.data.objects.new('arch_lamp', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    def rod(n, a, b, r=0.007, mat=None):
        a, b = Vector(a), Vector(b); d = b - a
        c = K.cyl(n, r, d.length, (a + b) / 2, mat or M['bp_satin'], seg=12, bev=0); c.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); c.parent = g; return c
    base = K.cyl('al_base', 0.09, 0.03, (0, 0, 0.015), M['bp_satin'], seg=40, bev=0.008); base.parent = g
    j1, j2, j3 = (0, 0, 0.03), (0.05, 0.02, 0.42), (0.28, -0.02, 0.6)
    rod('al_arm1', j1, j2); rod('al_arm1b', (0.012, 0, 0.03), (0.062, 0.02, 0.42), 0.004)
    rod('al_arm2', j2, j3); rod('al_arm2b', (0.05, 0.032, 0.42), (0.28, -0.008, 0.6), 0.004)
    rod('al_spring', (0.02, 0.012, 0.1), (0.05, 0.02, 0.32), 0.006, M['chrome'])
    shade = K.lathe('al_shade', [(0.0, 0.0), (0.025, 0.0), (0.04, -0.03), (0.075, -0.1), (0.085, -0.16), (0.083, -0.161), (0.072, -0.1), (0.037, -0.03), (0.0, -0.004)], j3, M['bp_satin'], rot=(-35, 0, 0))
    shade.parent = g; K.subsurf(shade, 1)
    return g
