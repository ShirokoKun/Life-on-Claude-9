"""THE ROOM: a rebuild of the cluttered home office from the director's AI-room tutorial (docs/TUTORIAL_AI_ROOM_BUILD.md),
to match its quality: scripted architecture and hero objects, real assets where they beat modelling, PBR with wear,
daylight through venetian blinds, haze, Cycles.

Layout (metres, Blender z-up). The room is x 0..3.6 (left wall to right wall), y 0..3.3 (camera side to the window wall),
z 0..2.4. Back wall: three aluminium windows (wired frosted glass below a transom, clear above), venetian blinds.
Left wall: a fourth window with blinds, the split aircon above it. Furniture: an L desk (grey laminate, metal legs),
a beige 3-drawer pedestal under the return, a long walnut cubby unit on the right, a walnut side desk under a white
wire rack on the left, the black leather executive chair, clutter in clusters where the person works.

    blender -b --factory-startup --python blender/scenes/tutorial_room.py -- OUT.png [--res 1280x720] [--samples 64]
        [--clay] [--light day|sun|night] [--cam wide|desk|chair] [--blend out.blend] [--novol]
"""
import bpy, sys, os, math, random
from mathutils import Vector, Euler
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import importlib, room_kit as K, props_office as P
importlib.reload(K); importlib.reload(P)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv and not argv[0].startswith('--') else '/tmp/room.png'
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
RES = tuple(map(int, opt('--res', '1280x720').split('x')))
SAMPLES = int(opt('--samples', '64'))
LIGHT = opt('--light', 'day')            # day = the tutorial's final soft overcast; sun = its 'sunlight added' stage
CAM = opt('--cam', 'wide')
CLAY = '--clay' in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
R = random.Random(7)
W, DEP, H = 3.6, 3.3, 2.4          # room width (x), depth (y), height (z)

# ================================================================= materials
M = {
    'wall': K.mat_plain('wall_paint', (0.70, 0.68, 0.63), rough=0.85, bump=0.015, bump_scale=8),
    'ceiling': K.mat_plain('ceiling_paint', (0.78, 0.77, 0.74), rough=0.9, bump=0.01, bump_scale=10),
    'floor': K.mat_tex('floor_laminate', 'oak_floor', tile=1.7, tint=(1.25, 0.88, 0.6), rough_mul=0.4, rough_add=0.25, normal=0.5),
    'walnut': K.mat_tex('walnut', 'walnut', tile=0.6, tint=(1.0, 0.85, 0.72), rough_mul=0.5, rough_add=0.35, normal=0.5),
    'laminate': K.mat_plain('desk_laminate', (0.42, 0.42, 0.4), rough=0.42, bump=0.04, bump_scale=300),
    'beige_metal': K.mat_plain('beige_metal', (0.56, 0.52, 0.44), rough=0.38, metal=0.0, coat=0.2, bump=0.03, bump_scale=200),
    'alu': K.mat_plain('aluminium', (0.72, 0.73, 0.74), rough=0.32, metal=1.0, bump=0.02, bump_scale=150),
    'alu_dark': K.mat_plain('alu_dark', (0.36, 0.37, 0.38), rough=0.4, metal=1.0),
    'blind': K.mat_plain('blind_slat', (0.80, 0.80, 0.77), rough=0.38, coat=0.1, bump=0.08, bump_scale=60),
    'cord': K.mat_plain('cord', (0.85, 0.84, 0.8), rough=0.7),
    'glass': K.mat_glass('glass_clear', rough=0.02),
    'frosted': K.mat_glass('glass_frosted', rough=0.35, tint=(0.9, 0.92, 0.92)),
    'wireglass': K.mat_wireglass('glass_wired'),
    'black_plastic': K.mat_plain('black_plastic', (0.025, 0.025, 0.027), rough=0.45, bump=0.05, bump_scale=400),
    'gloss_black': K.mat_plain('gloss_black', (0.015, 0.015, 0.017), rough=0.15, coat=0.4),
    'white_plastic': K.mat_plain('white_plastic', (0.82, 0.82, 0.79), rough=0.45, bump=0.03, bump_scale=200),
    'chrome': K.mat_plain('chrome', (0.8, 0.8, 0.8), rough=0.12, metal=1.0),
    'leather': K.mat_leather(),
    'skirting': K.mat_plain('skirting', (0.45, 0.42, 0.38), rough=0.5),
}
if CLAY:
    clay = K.mat_plain('clay', (0.55, 0.55, 0.55), rough=0.6)
    for k in M:
        if k not in ('glass', 'wireglass', 'frosted'): M[k] = clay

# ================================================================= shell
K.cube('floor', (W, DEP, 0.04), (W / 2, DEP / 2, -0.02), M['floor'], bev=0)
K.cube('ceiling', (W, DEP, 0.04), (W / 2, DEP / 2, H + 0.02), M['ceiling'], bev=0)
K.cube('wall_front', (W, 0.12, H), (W / 2, -0.06, H / 2), M['wall'], bev=0)
K.cube('wall_right', (0.12, DEP, H), (W + 0.06, DEP / 2, H / 2), M['wall'], bev=0)
for side, x in (('L', -0.06),):
    pass
# walls with window openings: built from panels around the holes
def wall_with_holes(name, axis, coord, length, holes, thick=0.12):
    """axis 'y': a wall in the xz plane at y=coord spanning x 0..length; 'x': in the yz plane at x=coord spanning y 0..length.
    holes: [(a0, a1, z0, z1)] along the wall."""
    cuts = sorted(holes); a = 0.0
    def panel(a0, a1, z0, z1, i):
        if a1 - a0 < 1e-3 or z1 - z0 < 1e-3: return
        c = ((a0 + a1) / 2, (z0 + z1) / 2)
        if axis == 'y': K.cube(f'{name}_{i}', (a1 - a0, thick, z1 - z0), (c[0], coord, c[1]), M['wall'], bev=0)
        else: K.cube(f'{name}_{i}', (thick, a1 - a0, z1 - z0), (coord, c[0], c[1]), M['wall'], bev=0)
    i = 0
    for (a0, a1, z0, z1) in cuts:
        panel(a, a0, 0, H, i); i += 1
        panel(a0, a1, 0, z0, i); i += 1
        panel(a0, a1, z1, H, i); i += 1
        a = a1
    panel(a, length, 0, H, i)

WIN_Z0, WIN_Z1, TRANSOM = 0.86, 2.2, 1.34
BACK_WIN = (0.28, 3.42)                        # the back wall's window band (x)
LEFT_WIN = (1.55, 2.95)                        # the left wall's window (y)
wall_with_holes('wall_back', 'y', DEP + 0.06, W, [(BACK_WIN[0], BACK_WIN[1], WIN_Z0, WIN_Z1)])
wall_with_holes('wall_left', 'x', -0.06, DEP, [(LEFT_WIN[0], LEFT_WIN[1], WIN_Z0, WIN_Z1)])
# skirting boards
for (n, s, l) in (('skirt_r', (0.012, DEP, 0.07), (W - 0.006, DEP / 2, 0.035)), ('skirt_f', (W, 0.012, 0.07), (W / 2, 0.006, 0.035)),
                  ('skirt_l', (0.012, DEP, 0.07), (0.006, DEP / 2, 0.035)), ('skirt_b', (W, 0.012, 0.07), (W / 2, DEP - 0.006, 0.035))):
    K.cube(n, s, l, M['skirting'], bev=0.002)
# window sills (the deep interior ledge mugs and junk sit on)
K.cube('sill_back', (BACK_WIN[1] - BACK_WIN[0] + 0.1, 0.2, 0.03), ((BACK_WIN[0] + BACK_WIN[1]) / 2, DEP - 0.04, WIN_Z0 - 0.015), M['white_plastic'])
K.cube('sill_left', (0.2, LEFT_WIN[1] - LEFT_WIN[0] + 0.1, 0.03), (0.04, (LEFT_WIN[0] + LEFT_WIN[1]) / 2, WIN_Z0 - 0.015), M['white_plastic'])

# ================================================================= windows: aluminium frames, transoms, wired + clear glass
def window(name, axis, coord, a0, a1, panes, blinds):
    """Frames along a wall. axis 'y' = back wall (normal -y), 'x' = left wall (normal +x)."""
    def put(n, size_along, size_depth, size_z, along, z, mat):
        if axis == 'y': K.cube(n, (size_along, size_depth, size_z), (along, coord, z), mat, bev=0.002)
        else: K.cube(n, (size_depth, size_along, size_z), (coord, along, z), mat, bev=0.002)
    fw = 0.045
    put(f'{name}_head', a1 - a0, 0.07, fw, (a0 + a1) / 2, WIN_Z1 - fw / 2, M['alu'])
    put(f'{name}_sillframe', a1 - a0, 0.07, fw, (a0 + a1) / 2, WIN_Z0 + fw / 2, M['alu'])
    edges = [a0 + (a1 - a0) * i / panes for i in range(panes + 1)]
    for i, e in enumerate(edges):
        put(f'{name}_mull{i}', 0.055 if 0 < i < panes else fw, 0.075, WIN_Z1 - WIN_Z0, min(max(e, a0 + fw / 2), a1 - fw / 2), (WIN_Z0 + WIN_Z1) / 2, M['alu'])
    for i in range(panes):
        p0, p1 = edges[i], edges[i + 1]; mid = (p0 + p1) / 2; w = p1 - p0 - 0.05
        put(f'{name}_transom{i}', w, 0.06, 0.04, mid, TRANSOM, M['alu'])
        put(f'{name}_lowglass{i}', w, 0.008, TRANSOM - WIN_Z0 - 0.06, mid, (WIN_Z0 + TRANSOM) / 2, M['wireglass'])
        put(f'{name}_highglass{i}', w, 0.006, WIN_Z1 - TRANSOM - 0.06, mid, (TRANSOM + WIN_Z1) / 2, M['frosted'] if (name == 'win_back' and i == 0) else M['glass'])
        if blinds[i] is not None:
            venetian(f'{name}_blind{i}', axis, coord - (0.09 if axis == 'y' else -0.09), p0 + 0.03, p1 - 0.03, WIN_Z1 - 0.02, blinds[i])

# ---------------------------------------------------------------- the blinds (the hero system object: they shape the light)
def venetian(name, axis, coord, a0, a1, top, drop, tilt=38.0):
    """25 mm aluminium slats on 21 mm pitch, curved; headrail, bottom rail, ladder strings, a tilt wand, a pull cord.
    drop: how far down the slats hang (m); a raised blind has its slats stacked under the headrail."""
    import bmesh
    width = a1 - a0; n = max(3, int(drop / 0.021))
    # every slat built in place: a 25 mm curved strip, tilted about its own long axis (light passes between them)
    me = bpy.data.meshes.new(name + '_slats'); bm = bmesh.new()
    seg = 5; t = math.radians(tilt)
    for k in range(n):
        zc = -0.05 - 0.021 * k
        prof = []
        for j in range(seg + 1):
            u = -0.0125 + 0.025 * j / seg; v = 0.0018 * math.sin(math.pi * j / seg)
            prof.append((u * math.cos(t) - v * math.sin(t), zc + u * math.sin(t) + v * math.cos(t)))
        L_ = [bm.verts.new((-width / 2, d, z)) for d, z in prof]; R_ = [bm.verts.new((width / 2, d, z)) for d, z in prof]
        for j in range(seg): bm.faces.new((L_[j], L_[j + 1], R_[j + 1], R_[j]))
    bm.to_mesh(me); bm.free()
    slat = bpy.data.objects.new(name + '_slats', me); K.link(slat); me.materials.append(M['blind'])
    for p in me.polygons: p.use_smooth = True
    sol = slat.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.0006
    mid = (a0 + a1) / 2
    if axis == 'y': slat.location = (mid, coord, top)
    else: slat.location = (coord, mid, top); slat.rotation_euler = Euler((0, 0, math.radians(90)))
    def put(n_, size, loc_along, z, mat, depth=0.045):
        if axis == 'y': K.cube(n_, (size, depth, 0.04 if 'rail' in n_ else size), (loc_along, coord, z), mat, bev=0.004)
        else: K.cube(n_, (depth, size, 0.04 if 'rail' in n_ else size), (coord, loc_along, z), mat, bev=0.004)
    put(name + '_headrail', width + 0.01, mid, top - 0.02, M['blind'])
    bottom = top - 0.05 - 0.021 * n
    put(name + '_bottomrail', width, mid, bottom - 0.01, M['blind'], depth=0.03)
    # ladder strings (front and back of the slats, two ladders)
    for frac in (0.12, 0.88):
        along = a0 + width * frac
        for dd in (-0.012, 0.012):
            p = (along, coord + dd, (top + bottom) / 2) if axis == 'y' else (coord + dd, along, (top + bottom) / 2)
            K.cyl(name + '_ladder', 0.0006, top - bottom, p, M['cord'], seg=4, bev=0)
    # the tilt wand and the pull cord with its tassels (left side)
    wa = a0 + 0.04
    pw = (wa, coord - 0.03, top - 0.35) if axis == 'y' else (coord + 0.03, wa, top - 0.35)
    K.cyl(name + '_wand', 0.004, 0.62, pw, M['white_plastic'], seg=8)
    pc = a1 - 0.05
    for k, off in enumerate((0, 0.012)):
        L = 0.75 + 0.03 * k
        p = (pc + off, coord - 0.02, top - L / 2) if axis == 'y' else (coord + 0.02, pc + off, top - L / 2)
        K.cyl(name + '_cord', 0.0011, L, p, M['cord'], seg=5, bev=0)
        pt = (pc + off, coord - 0.02, top - L - 0.02) if axis == 'y' else (coord + 0.02, pc + off, top - L - 0.02)
        K.cyl(name + '_tassel', 0.007, 0.04, pt, M['chrome'], seg=12, r2=0.005)

# back wall: three panes. Left pane: blind raised (the frosted glass shows bright); centre and right: blinds down to the sill
window('win_back', 'y', DEP - 0.02, BACK_WIN[0], BACK_WIN[1], 3, [0.12, WIN_Z1 - WIN_Z0 - 0.08, WIN_Z1 - WIN_Z0 - 0.08])
window('win_left', 'x', 0.02, LEFT_WIN[0], LEFT_WIN[1], 1, [WIN_Z1 - WIN_Z0 - 0.1])

# ================================================================= furniture
DESK_Z = 0.72
# the main desk along the window wall, and its return toward the room on the right
def desk(name, x0, x1, y0, y1, legs=True):
    K.cube(name + '_top', (x1 - x0, y1 - y0, 0.028), ((x0 + x1) / 2, (y0 + y1) / 2, DESK_Z - 0.014), M['laminate'], bev=0.004, seg=3)
    K.cube(name + '_edge', (x1 - x0, 0.004, 0.028), ((x0 + x1) / 2, y0 - 0.002, DESK_Z - 0.014), M['alu_dark'], bev=0.001)
    if legs:
        for (lx, ly) in ((x0 + 0.04, y0 + 0.05), (x0 + 0.04, y1 - 0.05), (x1 - 0.04, y0 + 0.05), (x1 - 0.04, y1 - 0.05)):
            K.cube(name + '_leg', (0.035, 0.035, DESK_Z - 0.028), (lx, ly, (DESK_Z - 0.028) / 2), M['alu_dark'], bev=0.003)
        K.cube(name + '_modesty', (x1 - x0 - 0.1, 0.012, 0.3), ((x0 + x1) / 2, y1 - 0.06, DESK_Z - 0.2), M['laminate'], bev=0.002)
desk('desk_main', 0.75, 3.05, 2.45, 3.18)
desk('desk_return', 2.3, 3.05, 1.25, 2.45)
# the beige 3-drawer pedestal under the return (two big drawers + a pencil drawer)
PX, PY = 2.67, 1.62
K.cube('ped_body', (0.42, 0.55, 0.62), (PX, PY, 0.31 + 0.04), M['beige_metal'], bev=0.006, seg=3)
for k, (z, hgt) in enumerate(((0.56, 0.12), (0.39, 0.2), (0.16, 0.22))):
    K.cube(f'ped_drawer{k}', (0.405, 0.012, hgt - 0.012), (PX, PY - 0.28, z + 0.04), M['beige_metal'], bev=0.003)
    K.cube(f'ped_handle{k}', (0.12, 0.012, 0.012), (PX, PY - 0.292, z + hgt / 2 - 0.03 + 0.04), M['chrome'], bev=0.003)
    K.cube(f'ped_label{k}', (0.05, 0.003, 0.025), (PX, PY - 0.288, z + 0.025 + 0.04), M['white_plastic'], bev=0.001)
for (cx, cy) in ((PX - 0.17, PY - 0.22), (PX + 0.17, PY - 0.22), (PX - 0.17, PY + 0.22), (PX + 0.17, PY + 0.22)):
    K.cyl('ped_caster', 0.02, 0.025, (cx, cy, 0.02), M['black_plastic'], rot=(0, 90, 0), seg=16)
# the long walnut cubby unit along the right wall (open boxes, books and files in them)
def cubbies(name, x0, x1, y0, y1, z0, z1, cols, rows, t=0.018):
    K.cube(name + '_top', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z1 - t / 2), M['walnut'], bev=0.002)
    K.cube(name + '_bot', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z0 + t / 2), M['walnut'], bev=0.002)
    K.cube(name + '_back', (x1 - x0, 0.006, z1 - z0), ((x0 + x1) / 2, y1 - 0.003, (z0 + z1) / 2), M['walnut'], bev=0) if y1 - y0 < 0.6 else None
    along_x = (x1 - x0) > (y1 - y0)
    for i in range(cols + 1):
        if along_x: K.cube(name + '_div', (t, y1 - y0, z1 - z0), (x0 + t / 2 + (x1 - x0 - t) * i / cols, (y0 + y1) / 2, (z0 + z1) / 2), M['walnut'], bev=0.002)
        else: K.cube(name + '_div', (x1 - x0, t, z1 - z0), ((x0 + x1) / 2, y0 + t / 2 + (y1 - y0 - t) * i / cols, (z0 + z1) / 2), M['walnut'], bev=0.002)
    for j in range(1, rows):
        K.cube(name + '_shelf', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z0 + (z1 - z0) * j / rows), M['walnut'], bev=0.002)
cubbies('cubby_right', W - 0.42, W - 0.02, 0.95, 2.35, 0.04, 0.92, 3, 2)
# the walnut side desk on the left and the white wire rack standing on it, plastic boxes on top
K.cube('side_desk_top', (0.6, 1.1, 0.03), (0.32, 2.55, DESK_Z - 0.015), M['walnut'], bev=0.004)
K.cube('side_desk_panel', (0.6, 0.03, DESK_Z - 0.03), (0.32, 2.015, (DESK_Z - 0.03) / 2), M['walnut'], bev=0.003)
K.cube('side_desk_drawers', (0.55, 0.45, DESK_Z - 0.06), (0.32, 3.0, (DESK_Z - 0.06) / 2 + 0.02), M['walnut'], bev=0.004)
wire = K.mat_plain('wire_white', (0.85, 0.85, 0.83), rough=0.35, coat=0.3)
for (rx, ry) in ((0.06, 2.2), (0.56, 2.2), (0.06, 2.62), (0.56, 2.62)):
    K.cyl('rack_post', 0.008, 1.0, (rx, ry, DESK_Z + 0.5), wire, seg=10)
for z in (DESK_Z + 0.25, DESK_Z + 0.62, DESK_Z + 0.98):
    for k in range(9):
        K.cyl('rack_wire', 0.0025, 0.5, (0.06 + 0.5 * k / 8, 2.41, z), wire, rot=(90, 0, 0), seg=6, bev=0)
    for yy in (2.2, 2.62):
        K.cyl('rack_rim', 0.004, 0.5, (0.31, yy, z), wire, rot=(0, 90, 0), seg=8, bev=0)

# ================================================================= the black leather executive chair (modelled; subdivided)
def exec_chair(loc, rz):
    import bmesh
    g = bpy.data.objects.new('chair', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    parts = []
    def pillow(name, size, at, round_=0.4, rot=(0, 0, 0)):
        o = K.cube(name, size, at, M['leather'], bev=0, rot=rot)
        bv = o.modifiers.new('round', 'BEVEL'); bv.width = min(size) * round_; bv.segments = 3
        K.subsurf(o, 2); o.parent = g; parts.append(o)
        o.modifiers['sub'].levels = 3; o.modifiers['sub'].render_levels = 3
        d = o.modifiers.new('creases', 'DISPLACE'); t = bpy.data.textures.get('leather_creases') or bpy.data.textures.new('leather_creases', 'VORONOI')
        t.noise_scale = 0.06; t.distance_metric = 'DISTANCE'; d.texture = t; d.strength = 0.006; d.mid_level = 0.5; d.texture_coords = 'OBJECT'
        return o
    # seat: a thick cushion with a rolled front edge
    pillow('chair_seat', (0.52, 0.5, 0.13), (0, 0.0, 0.50))
    pillow('chair_seat_roll', (0.5, 0.12, 0.1), (0, -0.21, 0.52), round_=0.5)
    # back: a tall shell with four stacked rolls (the tufted executive look) and a head roll
    pillow('chair_back_shell', (0.54, 0.12, 0.74), (0, 0.27, 0.98), rot=(-10, 0, 0))
    for k in range(4):
        pillow(f'chair_back_roll{k}', (0.46, 0.1, 0.17), (0, 0.205 - 0.03 * (k / 3), 0.73 + 0.165 * k), round_=0.5, rot=(-10, 0, 0))
    pillow('chair_head', (0.5, 0.13, 0.17), (0, 0.33, 1.38), round_=0.5, rot=(-12, 0, 0))
    for sd in (-1, 1):   # the thick side bolsters that wrap the back
        pillow('chair_bolster', (0.08, 0.15, 0.7), (sd * 0.26, 0.24, 0.98), round_=0.5, rot=(-10, 0, sd * 8))
    # padded arms: loops from the seat's back corners forward and down
    for s in (-1, 1):   # padded arms: a soft pad on a leather-wrapped loop down to the seat
        pillow('chair_arm_pad', (0.085, 0.36, 0.06), (s * 0.3, -0.02, 0.69), round_=0.5)
        pillow('chair_arm_front', (0.07, 0.07, 0.2), (s * 0.3, -0.17, 0.6), round_=0.5)
        pillow('chair_arm_back', (0.07, 0.07, 0.2), (s * 0.3, 0.14, 0.6), round_=0.5)
    # mechanism, gas lift, five-star base with casters
    m1 = K.cube('chair_mech', (0.26, 0.24, 0.05), (0, 0.02, 0.41), M['black_plastic'], bev=0.006); m1.parent = g
    gl = K.cyl('chair_gas', 0.025, 0.24, (0, 0.02, 0.28), M['chrome'], seg=24); gl.parent = g
    sh = K.cyl('chair_gas_shroud', 0.035, 0.12, (0, 0.02, 0.17), M['black_plastic'], seg=24); sh.parent = g
    for k in range(5):
        a = math.radians(90 + 72 * k); ex, ey = math.cos(a) * 0.32, 0.02 + math.sin(a) * 0.32
        leg = K.cube('chair_leg', (0.33, 0.045, 0.035), (math.cos(a) * 0.165, 0.02 + math.sin(a) * 0.165, 0.1), M['black_plastic'], bev=0.01, rot=(0, -6, math.degrees(a)))
        leg.parent = g
        w = K.cyl('chair_caster', 0.025, 0.022, (ex, ey, 0.03), M['black_plastic'], rot=(90, 0, math.degrees(a) + 90), seg=20); w.parent = g
        f = K.cube('chair_fork', (0.03, 0.03, 0.04), (ex, ey, 0.06), M['black_plastic'], bev=0.006); f.parent = g
    return g

exec_chair((0.74, 2.08, 0), 40)


# ================================================================= dressing: big -> mid -> small, clustered where he works
PM = P._m()
if CLAY:
    for k in PM:
        if k not in ('screen_on',) and 'glass' not in k and 'clear' not in k: PM[k] = M['laminate']
DZ = DESK_Z
# the workstation, centre of the main desk: two monitors (left one off), webcam, keyboard, mouse
P.monitor('mon_left', (1.32, 2.98, DZ), 8, False, PM)
P.monitor('mon_right', (1.98, 2.96, DZ), -6, True, PM, size=(0.56, 0.33))
K.cube('webcam', (0.08, 0.03, 0.03), (1.98, 2.985, DZ + 0.37 + 0.02), PM['bp_satin'], bev=0.008)
P.keyboard((1.7, 2.66, DZ), -2, PM)
P.mouse((2.1, 2.66, DZ), -8, PM)
# the desk lamp (black, arm) at the back left of the desk
P.architect_lamp((0.98, 3.0, DZ), 20, PM)
# the tower at the right end with the two figures on top; the cork board leaning on the window behind
P.pc_tower((2.78, 2.86, DZ), -4, PM)
P.red_bear_toy((2.74, 2.86, DZ + 0.44), -25, PM)
P.robot_figure((2.84, 2.95, DZ + 0.44), -10, PM)
P.cork_board((2.32, 3.12, DZ), 0, PM)
# the working clutter in front of the screens: mug, glass of tea, bottles, a red box, a can, tape, pens, junk
P.mug('mug_main', (2.27, 2.58, DZ), PM)
P.glass_cup((2.5, 2.74, DZ), PM)
P.bottle('tea_bottle', (1.62, 2.93, DZ), PM, 'tea'); P.bottle('white_bottle', (1.75, 2.95, DZ), PM, 'white')
P.red_box((2.2, 2.86, DZ), 12, PM)
P.can((1.15, 2.78, DZ), PM)
K.asset('medical_tape', (2.42, 2.9, DZ + 0.012), scale=1.6); K.asset('medical_tape', (2.47, 2.95, DZ + 0.012), scale=1.4)
K.asset('stationery_supplies', (2.6, 2.95, DZ + 0.07), rz=80)
K.asset('circuit_board', (2.48, 3.02, DZ + 0.012), rz=20, scale=0.6)
K.asset('retro_multimeter', (2.95, 2.62, DZ), rz=-30, scale=0.8)
K.asset('pliers', (2.62, 2.66, DZ + 0.01), rz=60, rx=90)
K.asset('digital_wrist_watch', (2.38, 2.66, DZ + 0.004), rz=20)
P.paper_stack((2.95, 2.95, DZ), 14, PM, rz=4)
# the return: the open laptop, a notepad, papers
P.laptop((2.6, 1.8, DZ), 205, PM)
K.asset('office_notepads', (2.55, 2.2, DZ + 0.001), rz=95, scale=0.45)
P.paper_stack((2.85, 1.45, DZ), 6, PM, rz=30, size=(0.28, 0.21))
# the window sill: mugs, a stack of magazines
P.mug('sill_mug1', (3.12, 3.22, WIN_Z0), PM, 'ceramic_white', tea=False); P.mug('sill_mug2', (3.26, 3.2, WIN_Z0), PM, 'ceramic_beige', tea=False)
P.paper_stack((0.5, 3.2, WIN_Z0), 10, PM, rz=0, size=(0.22, 0.16))
# the gooseneck lamp on the right cubby unit, books and binders inside the cubbies
P.gooseneck_lamp((W - 0.22, 2.1, 0.92), 160, PM)
P.book_row(W - 0.38, 0.4, 0.06, 0.45, PM, axis='y', rz=0)
P.book_row(W - 0.38, 0.9, 0.06, 0.4, PM, axis='y', rz=0)
P.book_row(W - 0.38, 1.4, 0.49, 0.42, PM, axis='y', rz=0)
K.asset('binder_notebook', (W - 0.25, 1.95, 0.08), rz=90, rx=90)
P.book_stack((W - 0.22, 1.0, 0.92), 6, PM, rz=90)
# the left: books stacked high on the side desk, the wire rack with storage boxes, a tissue box
P.book_stack((0.3, 2.85, DESK_Z), 12, PM, rz=5)
P.book_stack((0.32, 2.4, DESK_Z), 7, PM, rz=-6)
P.storage_box((0.31, 2.41, DESK_Z + 0.99), 0, PM)
P.storage_box((0.31, 2.41, DESK_Z + 0.63), 0, PM, size=(0.42, 0.3, 0.14))
K.cube('tissue_box', (0.24, 0.12, 0.09), (0.3, 2.42, DESK_Z + 0.25 + 0.045), K.mat_plain('tissue', (0.62, 0.72, 0.85), rough=0.6), bev=0.004)
K.asset('cassette_player', (0.45, 2.4, DESK_Z + 0.25 + 0.12), rz=90)
# the floor: cooler bag and vacuum at the left, paper bags, the waste basket by the pedestal, boxes under the desk, cables
P.cooler_bag((0.35, 0.75, 0), 15, PM)
P.stick_vacuum((0.1, 1.3, 0), 90, PM)
P.paper_bag((0.62, 1.6, 0), 20, PM); P.paper_bag((3.05, 0.6, 0), -15, PM, h=0.28)
P.waste_basket((2.12, 1.15, 0), PM)
K.asset('cardboard_box_01', (1.55, 3.0, 0), rz=10, scale=1.3); K.asset('cardboard_box_01', (0.95, 2.95, 0), rz=-5, scale=1.1)
K.cube('white_box', (0.28, 0.24, 0.3), (2.0, 2.85, 0.15), PM['label'], bev=0.006)
P.cable('cable_pc', [(2.75, 3.05, DZ), (2.7, 3.12, 0.5), (2.5, 3.1, 0.02), (2.0, 3.0, 0.01), (1.6, 2.9, 0.01)], PM)
P.cable('cable_lap', [(2.7, 1.9, DZ), (2.95, 1.95, 0.5), (3.0, 1.3, 0.02), (2.6, 0.9, 0.01), (2.2, 0.8, 0.01)], PM)
K.cube('power_strip', (0.32, 0.06, 0.04), (1.75, 2.85, 0.02), PM['ivory'], bev=0.006, rot=(0, 0, 15))

# more life (the tutorial's density): the left end of the desk, under the desk, the floor by the chair
P.book_stack((0.92, 2.72, DZ), 9, PM, rz=-3)
K.cube('tissue_box2', (0.24, 0.12, 0.09), (1.08, 3.02, DZ + 0.045), K.mat_plain('tissue2', (0.85, 0.82, 0.78), rough=0.6), bev=0.004)
P.paper_stack((1.35, 2.62, DZ), 5, PM, rz=-12, size=(0.25, 0.32))
K.cube('game_pad', (0.15, 0.1, 0.05), (1.12, 2.62, DZ + 0.025), PM['bp_satin'], bev=0.02, rot=(0, 0, 25))
K.cube('headphones_band', (0.17, 0.04, 0.02), (2.95, 2.4, DZ + 0.01), PM['bp'], bev=0.008, rot=(0, 0, -30))
for (x, y, rz_, sc_) in ((1.25, 2.95, 20, 1.0), (2.45, 3.0, -10, 0.9), (0.6, 1.95, 35, 1.2)):
    K.asset('cardboard_box_01', (x, y, 0.0 if y < 2.9 else 0.0), rz=rz_, scale=sc_)
P.book_stack((1.75, 2.55, 0.0), 6, PM, rz=30)
P.paper_stack((1.05, 1.15, 0.0), 4, PM, rz=40)
P.paper_bag((2.95, 2.95, DZ), 80, PM, h=0.24)
P.mug('desk_mug2', (1.5, 2.9, DZ), PM, 'ceramic_white', tea=False)

# density pass (the tutorial's level): the sill lined with mugs and bottles, a wall of binders, piles on every surface
for k, x in enumerate((0.55, 0.72, 0.9, 1.6, 1.78, 2.05, 3.0, 3.18, 3.32)):
    if k % 3 == 2: P.bottle(f'sill_bottle{k}', (x, 3.22, WIN_Z0), PM, 'white' if k % 2 else 'tea')
    else: P.mug(f'sill_mug_x{k}', (x, 3.22, WIN_Z0), PM, 'ceramic_white' if k % 2 else 'ceramic_beige', tea=False)
P.paper_stack((2.98, 3.0, DZ + 0.06), 18, PM, rz=-6, size=(0.3, 0.24))
K.asset('cardboard_box_01', (2.55, 3.1, DZ), rz=90, scale=1.15)
binder_mats = [K.mat_plain(f'binder{k}', c, rough=0.4) for k, c in enumerate(((0.85, 0.85, 0.83), (0.2, 0.3, 0.55), (0.85, 0.85, 0.83), (0.85, 0.85, 0.83)))]
for k in range(9):   # white and blue lever-arch files in the right cubbies
    K.cube('binder', (0.3, 0.06, 0.32), (W - 0.24, 1.42 + k * 0.065, 0.06 + 0.16), binder_mats[k % 4], bev=0.004)
P.book_row(W - 0.38, 1.95, 0.49, 0.38, PM, axis='y', rz=0)
P.book_stack((0.3, 2.0, DESK_Z), 5, PM, rz=12)
P.paper_stack((0.3, 2.55, DESK_Z + 0.25), 6, PM, rz=0, size=(0.3, 0.22))
P.book_stack((W - 0.3, 0.45, 0.0), 8, PM, rz=-20)
P.paper_bag((1.95, 0.75, 0), -40, PM, h=0.3)
K.cube('shoebox', (0.32, 0.2, 0.12), (2.35, 2.98, 0.06), PM['red_card'], bev=0.004, rot=(0, 0, 8))
P.can((1.95, 2.95, DZ), PM); P.can((2.68, 2.55, DZ), PM)
P.bottle('desk_bottle3', (2.35, 3.05, DZ), PM, 'white')
K.asset('Camera_01', (0.98, 2.65, DZ + 0.06), rz=40)

# the tall bookcase in the right foreground (walnut, five shelves, packed)
cubbies('bookcase', W - 0.36, W - 0.02, 0.04, 0.9, 0.0, 1.85, 1, 5)
for j in range(5):
    P.book_row(W - 0.3, 0.07, 0.02 + 1.85 * j / 5, 0.8, PM, axis='y', rz=0)

# ================================================================= ceiling, aircon, clock
# the flush ceiling light: a dark drum with a white diffuser ring (as in the tutorial)
K.cyl('ceil_lamp_rim', 0.26, 0.09, (1.8, 1.65, H - 0.045), M['black_plastic'], seg=48, bev=0.01)
K.cyl('ceil_lamp_diffuser', 0.2, 0.012, (1.8, 1.65, H - 0.093), K.mat_emit('ceil_diffuser', K.kelvin(4200), 0.0 if LIGHT != 'night' else 0.0) if False else M['white_plastic'], seg=48, bev=0.004)
K.cyl('ceil_lamp_center', 0.07, 0.016, (1.8, 1.65, H - 0.1), M['black_plastic'], seg=32, bev=0.004)
K.cube('aircon', (0.82, 0.24, 0.28), (0.13, 2.25, 2.2), M['white_plastic'], bev=0.04, seg=4, rot=(0, 0, 90))
K.cube('aircon_vent', (0.7, 0.02, 0.05), (0.25, 2.25, 2.1), M['black_plastic'], bev=0.005, rot=(0, 0, 90))
K.asset('wall_clock', (W - 0.03, 2.75, 1.95), rz=90)

# ================================================================= light
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
sky = w.node_tree.nodes.new('ShaderNodeTexSky')
try:
    sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_elevation = math.radians(28); sky.sun_rotation = math.radians(200); sky.altitude = 0; sky.air_density = 1.5; sky.dust_density = 4.0
except Exception as e:
    print('sky', e)
w.node_tree.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.35 if LIGHT != 'night' else 0.0
# window portals: tell Cycles where the daylight comes in (faster, cleaner interior light)
for (n, loc, rot, size) in (('portal_back', ((BACK_WIN[0] + BACK_WIN[1]) / 2, DEP + 0.02, (WIN_Z0 + WIN_Z1) / 2), (-90, 0, 0), (BACK_WIN[1] - BACK_WIN[0], WIN_Z1 - WIN_Z0)),
                            ('portal_left', (-0.02, (LEFT_WIN[0] + LEFT_WIN[1]) / 2, (WIN_Z0 + WIN_Z1) / 2), (0, -90, 0), (LEFT_WIN[1] - LEFT_WIN[0], WIN_Z1 - WIN_Z0))):
    p = K.lamp('AREA', n, loc, 0, (1, 1, 1), rot=rot, size=size); p.data.cycles.is_portal = True if hasattr(p.data, 'cycles') else None
    try: p.data.cycles.is_portal = True
    except Exception: pass
# the outside: a pale overcast field behind the glass (the tutorial's windows read as bright fog)
outside = K.cube('outside', (12, 0.05, 6), (W / 2, DEP + 3.5, 1.5), K.mat_emit('outside_fog', (0.82, 0.86, 0.9), 2.2 if LIGHT != 'night' else 0.0), bev=0)
outside_l = K.cube('outside_l', (0.05, 12, 6), (-3.0, DEP / 2, 1.5), K.mat_emit('outside_fog_l', (0.82, 0.86, 0.9), 1.6 if LIGHT != 'night' else 0.0), bev=0)
for o in (outside, outside_l): o.visible_shadow = False
if LIGHT in ('sun',):
    sun = K.lamp('SUN', 'sun', (0, 0, 10), 6.0, K.kelvin(5200), rot=(62, 0, 205), size=0.6)

# ================================================================= air (haze: shows the light through the blinds)
if '--novol' not in argv and LIGHT != 'night':
    v = bpy.data.materials.new('room_air'); v.use_nodes = True; vn = v.node_tree.nodes; vn.clear()
    pv = vn.new('ShaderNodeVolumePrincipled'); pv.inputs['Density'].default_value = 0.04; pv.inputs['Anisotropy'].default_value = 0.6
    vo = vn.new('ShaderNodeOutputMaterial'); v.node_tree.links.new(pv.outputs[0], vo.inputs['Volume'])
    air = K.cube('air', (W - 0.02, DEP - 0.02, H - 0.02), (W / 2, DEP / 2, H / 2), v, bev=0); air.visible_shadow = False

# ================================================================= camera
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); K.link(cam); sc.camera = cam
cam.data.sensor_width = 36
CAMS = {   # (location, look-at, lens mm)
    'wide': ((1.75, 0.07, 1.58), (1.9, 3.3, 1.0), 16),     # square to the window wall, from the door
    'desk': ((1.6, 1.55, 1.35), (2.2, 3.0, 0.8), 24),
    'chair': ((0.9, 0.9, 1.25), (1.6, 2.2, 0.6), 22),
}
loc, at, lens = CAMS[CAM]
cam.location = loc; cam.data.lens = lens
d = Vector(at) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam.data.clip_start = 0.02

# ================================================================= render
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 4; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 6
sc.cycles.volume_bounces = 1; sc.cycles.sample_clamp_indirect = 6; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.cycles.volume_step_rate = 3.0; sc.cycles.use_light_tree = True
sc.render.resolution_x, sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except TypeError: pass
sc.view_settings.exposure = float(opt('--exposure', '0.45'))
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = OUT
if opt('--blend'): bpy.ops.wm.save_as_mainfile(filepath=opt('--blend'))
if opt('--anim'):
    # a handheld walk-in like the tutorial's film: a slow push toward the desk with operator sway (24 fps)
    n = int(opt('--anim')); sc.frame_start, sc.frame_end = 1, n; sc.render.fps = 24
    p0, p1 = Vector(loc), Vector(loc) + Vector((-0.1, 0.55, -0.08)); a0, a1 = Vector(at), Vector(at) + Vector((-0.15, 0, -0.05))
    for f in range(1, n + 1):
        u = (f - 1) / max(1, n - 1); e = u * u * (3 - 2 * u)
        sway = Vector((math.sin(f * 0.21) * 0.012 + math.sin(f * 0.53) * 0.004, math.sin(f * 0.17) * 0.006, math.sin(f * 0.29 + 1) * 0.008))
        cam.location = p0.lerp(p1, e) + sway
        cam.rotation_euler = (a0.lerp(a1, e) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.rotation_euler.y += math.sin(f * 0.13) * 0.006
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    sc.render.filepath = OUT.rstrip('/') + '/f_'
    bpy.ops.render.render(animation=True)
else:
    bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
