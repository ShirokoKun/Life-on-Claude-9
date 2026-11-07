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
    'wall': K.mat_tex('wall_paint', None, folder=os.path.join(K.ROOT, 'blender', 'assets', 'room', 'tex', 'beige_wall_001'), tile=1.6, tint=(0.66, 0.68, 0.64), rough_mul=0.25, rough_add=0.72, normal=0.35),   # the tutorial's dim grey-green paint
    'ceiling': K.mat_tex('ceiling_plaster', None, folder=os.path.join(K.ROOT, 'blender', 'assets', 'room', 'tex', 'grey_plaster_02'), tile=1.5, tint=(0.7, 0.71, 0.69), rough_mul=0.2, rough_add=0.78, normal=0.3),
    'floor': K.mat_tex('floor_laminate', 'oak_floor', tile=1.7, tint=(0.8, 0.6, 0.45), rough_mul=0.4, rough_add=0.22, normal=0.5),   # warm grey-brown laminate, not orange
    'walnut': K.mat_tex('walnut', 'walnut', tile=0.6, tint=(1.0, 0.85, 0.72), rough_mul=0.5, rough_add=0.35, normal=0.5),
    'laminate': K.mat_plain('desk_laminate', (0.56, 0.56, 0.54), rough=0.5, spec=0.35, bump=0.012, bump_scale=60),   # satin: catches the window as a soft sheen, never a mirror
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
fw_ = K.cube('wall_front', (W, 0.12, H), (W / 2, -0.06, H / 2), M['wall'], bev=0); fw_.visible_camera = '--wall-off' not in argv   # the walk-through turns to see it (the door); --wall-off for the long wide
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
def cubbies(name, x0, x1, y0, y1, z0, z1, cols, rows, t=0.018, mat=None):
    MW = mat or M['walnut']
    K.cube(name + '_top', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z1 - t / 2), MW, bev=0.002)
    K.cube(name + '_bot', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z0 + t / 2), MW, bev=0.002)
    K.cube(name + '_back', (x1 - x0, 0.006, z1 - z0), ((x0 + x1) / 2, y1 - 0.003, (z0 + z1) / 2), MW, bev=0) if y1 - y0 < 0.6 else None
    along_x = (x1 - x0) > (y1 - y0)
    for i in range(cols + 1):
        if along_x: K.cube(name + '_div', (t, y1 - y0, z1 - z0), (x0 + t / 2 + (x1 - x0 - t) * i / cols, (y0 + y1) / 2, (z0 + z1) / 2), MW, bev=0.002)
        else: K.cube(name + '_div', (x1 - x0, t, z1 - z0), ((x0 + x1) / 2, y0 + t / 2 + (y1 - y0 - t) * i / cols, (z0 + z1) / 2), MW, bev=0.002)
    for j in range(1, rows):
        K.cube(name + '_shelf', (x1 - x0, y1 - y0, t), ((x0 + x1) / 2, (y0 + y1) / 2, z0 + (z1 - z0) * j / rows), MW, bev=0.002)
# the walnut side desk on the left and the white wire rack standing on it, plastic boxes on top
K.cube('side_desk_top', (0.6, 1.1, 0.03), (0.32, 2.55, DESK_Z - 0.015), M['walnut'], bev=0.004)
K.cube('side_desk_panel', (0.6, 0.03, DESK_Z - 0.03), (0.32, 2.015, (DESK_Z - 0.03) / 2), M['walnut'], bev=0.003)
K.cube('side_desk_drawers', (0.55, 0.45, DESK_Z - 0.06), (0.32, 3.0, (DESK_Z - 0.06) / 2 + 0.02), M['walnut'], bev=0.004)
wire = K.mat_plain('wire_white', (0.85, 0.85, 0.83), rough=0.35, coat=0.3)
for (rx, ry) in ((0.06, 2.55), (0.56, 2.55), (0.06, 2.97), (0.56, 2.97)):
    K.cyl('rack_post', 0.008, 1.0, (rx, ry, DESK_Z + 0.5), wire, seg=10)
for z in (DESK_Z + 0.25, DESK_Z + 0.62, DESK_Z + 0.98):
    for k in range(9):
        K.cyl('rack_wire', 0.0025, 0.42, (0.06 + 0.5 * k / 8, 2.76, z), wire, rot=(90, 0, 0), seg=6, bev=0)
    for yy in (2.55, 2.97):
        K.cyl('rack_rim', 0.004, 0.5, (0.31, yy, z), wire, rot=(0, 90, 0), seg=8, bev=0)

# ================================================================= the black leather executive chair (modelled; subdivided)
def exec_chair(loc, rz):
    import bmesh
    g = bpy.data.objects.new('chair', None); K.link(g); g.location = loc; g.rotation_euler = Euler((0, 0, math.radians(rz)))
    parts = []
    def pillow(name, size, at, round_=0.5, rot=(0, 0, 0)):
        o = K.cube(name, size, at, M['leather'], bev=0, rot=rot)
        bv = o.modifiers.new('round', 'BEVEL'); bv.width = min(size) * round_; bv.segments = 3
        K.subsurf(o, 2); o.parent = g; parts.append(o)
        o.modifiers['sub'].levels = 3; o.modifiers['sub'].render_levels = 3
        d = o.modifiers.new('creases', 'DISPLACE'); t = bpy.data.textures.get('leather_creases') or bpy.data.textures.new('leather_creases', 'VORONOI')
        t.noise_scale = 0.06; t.distance_metric = 'DISTANCE'; d.texture = t; d.strength = 0.006; d.mid_level = 0.5; d.texture_coords = 'OBJECT'
        return o
    def cush(name, size, at, **kw):
        o = K.cushion(name, size, at, M['leather'], **kw); o.parent = g; parts.append(o); return o
    # seat: a thick puffed cushion with pleats running front to back, and a rolled front lip
    cush('chair_seat', (0.54, 0.52, 0.15), (0, 0.0, 0.5), bulge=0.45, grooves=3, front='+z', groove_depth=0.35)
    cush('chair_seat_roll', (0.52, 0.13, 0.12), (0, -0.23, 0.52), bulge=0.5)
    # back: a padded shell, four tufted horizontal rolls, an integrated head roll, thick side bolsters
    cush('chair_back_shell', (0.56, 0.12, 0.78), (0, 0.29, 0.98), bulge=0.3, rot=(-10, 0, 0))
    for k in range(3):
        cush(f'chair_back_roll{k}', (0.48, 0.15, 0.2), (0, 0.2 - 0.02 * k, 0.74 + 0.19 * k), bulge=0.55, grooves=2, groove_axis='x', groove_depth=0.3, rot=(-10, 0, 0))
    cush('chair_head', (0.5, 0.16, 0.2), (0, 0.31, 1.33), bulge=0.6, rot=(-12, 0, 0))
    for sd in (-1, 1):
        cush('chair_bolster', (0.1, 0.17, 0.74), (sd * 0.27, 0.25, 0.98), bulge=0.5, rot=(-10, 0, sd * 10))
    # padded arms: a fat padded rest on a padded loop down to the seat
    for sd in (-1, 1):
        cush('chair_arm_pad', (0.1, 0.38, 0.08), (sd * 0.31, -0.03, 0.68), bulge=0.6, front='+z')
        cush('chair_arm_front', (0.085, 0.09, 0.2), (sd * 0.31, -0.18, 0.58), bulge=0.5)
        cush('chair_arm_back', (0.085, 0.09, 0.18), (sd * 0.31, 0.14, 0.6), bulge=0.5)
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

exec_chair((1.22, 1.95, 0), 196)   # at the main desk, facing the keyboard, turned a little toward the door


# ================================================================= dressing (placement map from the tutorial's final frames, t=0-12 s and 104-167 s)
PM = P._m()
if CLAY:
    for k in PM:
        if k not in ('screen_on',) and 'glass' not in k and 'clear' not in k: PM[k] = M['laminate']
DZ = DESK_Z
# --- the workstation (main desk, centre-left): left monitor off, right monitor on with the webcam, the black dome lamp
#     rising behind the left monitor with its head over it, keyboard + round mousepad + mouse in front of the right monitor
P.monitor('mon_left', (1.38, 2.97, DZ), 10, True, PM, size=(0.58, 0.34), screen=PM['screen_code'])
P.monitor('mon_right', (1.98, 2.93, DZ), -8, True, PM, size=(0.55, 0.33))
K.cube('webcam', (0.075, 0.03, 0.03), (1.985, 2.955, DZ + 0.37 + 0.02), PM['bp_satin'], bev=0.008)
P.architect_lamp((1.12, 3.1, DZ), 25, PM)
P.keyboard((1.83, 2.66, DZ), -6, PM)
K.cube('mousepad', (0.25, 0.21, 0.003), (2.18, 2.6, DZ + 0.0015), K.mat_tex('mousepad_cloth', 'fabric_weave', tile=0.08, tint=(0.32, 0.36, 0.42), rough_mul=0.2, rough_add=0.75, normal=0.4), bev=0.001, rot=(0, 0, -6))
mo = K.cube('mouse', (0.062, 0.105, 0.036), (2.17, 2.62, DZ + 0.02), K.mat_plain('mouse_plastic', (0.018, 0.018, 0.02), rough=0.5, spec=0.32, bump=0.02, bump_scale=900), bev=0.0, rot=(0, 0, -8))
mb = mo.modifiers.new('r', 'BEVEL'); mb.width = 0.022; mb.segments = 5; K.subsurf(mo, 2)
# --- around the keyboard: the controller and a black mat on the left, bottles between the monitors, the red box,
#     the beige mug, a glass of dark tea, a little calculator, tape rolls, pens and a spill of small junk on the right
K.cube('desk_mat', (0.3, 0.2, 0.003), (1.4, 2.72, DZ + 0.0015), PM['rubber'], bev=0.001, rot=(0, 0, 8))
ctrl = K.cube('controller', (0.15, 0.095, 0.045), (1.18, 2.78, DZ + 0.022), K.mat_plain('pad_white', (0.8, 0.82, 0.85), rough=0.35), bev=0.0, rot=(0, 0, 20))
cb = ctrl.modifiers.new('r', 'BEVEL'); cb.width = 0.02; cb.segments = 4; K.subsurf(ctrl, 1)
P.bottle('tea_bottle', (1.66, 2.92, DZ), PM, 'tea'); P.bottle('white_bottle', (1.76, 2.95, DZ), PM, 'white'); P.bottle('white_bottle2', (1.55, 2.88, DZ), PM, 'white')
P.red_box((1.98, 2.73, DZ), 15, PM)
P.mug('mug_main', (2.32, 2.6, DZ), PM)
P.glass_cup((2.58, 2.72, DZ), PM)
P.med_box((2.7, 2.6, DZ), -8, PM)
K.cube('calculator', (0.09, 0.13, 0.02), (2.47, 2.62, DZ + 0.01), K.mat_plain('calc', (0.82, 0.83, 0.8), rough=0.4), bev=0.004, rot=(0, 0, -15))
K.cube('calc_screen', (0.07, 0.035, 0.002), (2.465, 2.66, DZ + 0.021), K.mat_plain('lcd', (0.45, 0.55, 0.4), rough=0.2), bev=0, rot=(0, 0, -15))
K.asset('medical_tape', (2.4, 2.86, DZ + 0.012), scale=1.6); K.asset('medical_tape', (2.68, 2.98, DZ + 0.012), scale=1.4)
K.asset('stationery_supplies', (2.62, 2.9, DZ + 0.07), rz=80)
K.asset('circuit_board', (2.46, 3.02, DZ + 0.012), rz=20, scale=0.5)
K.asset('pliers', (2.72, 2.72, DZ + 0.01), rz=60, rx=90)
K.asset('digital_wrist_watch', (2.28, 2.84, DZ + 0.004), rz=20)
# the small life on the desk: receipts, a stapler, a clipboard of notes, cables, folded wrappers
rec = K.mat_image('receipt', os.path.join(P.ROOM_ASSETS, 'receipt.png'), axes='xy', rough=0.7)
for (x, y, r_) in ((2.5, 2.9, 20), (2.62, 2.95, -35), (2.45, 3.0, 70)):
    K.cube('receipt', (0.06, 0.14, 0.0006), (x, y, DZ + 0.004), rec, bev=0, rot=(0, 0, r_))
K.asset('vintage_stapler', (2.82, 2.7, DZ), rz=-60, scale=0.9)
K.asset('clipboard', (2.55, 2.05, DZ + 0.008), rz=100, rx=0)
P.snack_packet((2.55, 2.5, DZ + 0.01), 35, 1)   # one open packet in the free space by the glass
# --- the back right of the desk: the cork board (portrait, drawings pinned) leaning on the window behind the right monitor,
#     the tower with the two figures, a tall pile of magazines on a cardboard box, mugs along the sill, the gooseneck lamp
P.cork_board((2.3, 3.14, DZ), 0, PM, size=(0.46, 0.62))
P.pc_tower((2.78, 2.96, DZ), -4, PM)
P.red_bear_toy((2.74, 2.95, DZ + 0.44), -25, PM)
P.robot_figure((2.85, 3.03, DZ + 0.44), -10, PM)
K.asset('cardboard_box_01', (3.12, 3.02, WIN_Z0 - 0.01), rz=90, scale=1.2)
P.paper_stack((3.12, 3.02, WIN_Z0 + 0.33), 26, PM, rz=-4, size=(0.3, 0.23))
for k, x in enumerate((3.32, 3.42)):
    P.mug(f'sill_mug{k}', (x, 3.23, WIN_Z0), PM, 'ceramic_white' if k else 'ceramic_beige', tea=False)
P.gooseneck_lamp((3.42, 3.1, WIN_Z0), 220, PM)
for k, x in enumerate((0.42, 0.55, 0.68, 2.55)):    # more mugs and bottles along the sill (left of the tower: behind the monitors)
    (P.bottle if k % 2 else P.mug)(f'sill_x{k}', (x, 3.23, WIN_Z0), PM, *(('white',) if k % 2 else ('ceramic_beige', False)))
# --- the return (front, centre-right): the black laptop open toward the chair, papers; the beige pedestal under it
P.laptop((2.66, 1.68, DZ), 160, PM, mat=PM['gunmetal'])
P.paper_stack((2.85, 2.15, DZ), 6, PM, rz=30, size=(0.28, 0.21))
K.asset('office_notepads', (2.5, 2.2, DZ + 0.001), rz=95, scale=0.4)
# --- right of the return: a dark metal cabinet of binders, then the light-wood bookcase in the right foreground
dark_metal = K.mat_plain('dark_metal', (0.08, 0.08, 0.085), rough=0.45, metal=0.6)
cubbies('binder_cab', W - 0.46, W - 0.02, 1.5, 2.42, 0.0, 0.78, 2, 2, mat=dark_metal)
binder_mats = [K.mat_plain(f'binder{k}', c, rough=0.4) for k, c in enumerate(((0.85, 0.85, 0.83), (0.2, 0.3, 0.55), (0.85, 0.85, 0.83), (0.12, 0.12, 0.13)))]
for k in range(12):
    K.cube('binder', (0.28, 0.06, 0.32), (W - 0.25, 1.55 + k * 0.07, 0.03 + 0.16), binder_mats[k % 4], bev=0.004)
light_wood = K.mat_tex('bookcase_wood', 'light_wood', tile=0.8, tint=(1.0, 0.82, 0.6), rough_mul=0.4, rough_add=0.35)
cubbies('bookcase', W - 0.36, W - 0.02, 0.06, 1.42, 0.0, 1.9, 2, 5, mat=light_wood)
for j in range(5):
    for half in (0, 1):
        P.book_row(W - 0.3, 0.09 + half * 0.68, 0.02 + 1.9 * j / 5, 0.6, PM, axis='y', rz=0)
# --- the left: the low walnut cabinet under the left window with the white wire rack on it, storage boxes with blue lids
#     on top, a tall stack of books with a tissue box on top, a kraft bag, the cassette player
P.storage_box((0.31, 2.76, DESK_Z + 0.99), 0, PM, size=(0.38, 0.3, 0.17))
P.storage_box((0.31, 2.76, DESK_Z + 1.18), 0, PM, size=(0.36, 0.28, 0.14))
K.asset('cassette_player', (0.42, 2.76, DESK_Z + 0.62 + 0.12), rz=90)
P.book_stack((0.33, 2.25, DESK_Z), 14, PM, rz=5)
P.book_stack((0.4, 1.78, 0.0), 11, PM, rz=-12)
P.book_stack((0.45, 1.35, 0.0), 7, PM, rz=20)
K.cube('tissue_box', (0.24, 0.12, 0.09), (0.33, 2.25, DESK_Z + 0.42), K.mat_plain('tissue', (0.62, 0.72, 0.85), rough=0.6), bev=0.004)
P.book_stack((0.9, 2.62, DZ), 10, PM, rz=-3)
P.paper_bag((0.62, 1.78, 0), 20, PM)
# --- the leather chair: in front of the left monitor, turned toward the lens
# (placed by exec_chair below)
# --- floor: the vacuum against the left wall, the navy cooler bag, books and boxes under the desk (a blue product box),
#     the white wire basket with crumpled paper and a kraft bag by the pedestal, cables and a power strip
P.stick_vacuum((0.1, 1.15, 0), 90, PM)
P.cooler_bag((0.55, 0.42, 0.42), 8, PM)   # on the sofa, with the rest of the pile
P.waste_basket((2.2, 2.58, 0), PM)   # tucked under the desk corner
K.asset('cardboard_box_01', (1.0, 2.95, 0), rz=-5, scale=1.15); K.asset('cardboard_box_01', (1.62, 3.0, 0), rz=10, scale=1.2)
prod = K.cube('product_box', (0.34, 0.22, 0.26), (1.95, 2.85, 0.13), K.mat_plain('product_blue', (0.12, 0.17, 0.27), rough=0.4), bev=0.004, rot=(0, 0, -4))
K.cube('product_label', (0.2, 0.002, 0.06), (1.95, 2.739, 0.19), PM['label'], bev=0, rot=(0, 0, -4))
K.cube('white_box', (0.28, 0.24, 0.3), (2.35, 2.95, 0.15), PM['label'], bev=0.006)
P.book_stack((1.35, 2.7, 0.0), 6, PM, rz=30)
P.cable('cable_pc', [(2.75, 3.05, DZ), (2.7, 3.12, 0.5), (2.5, 3.1, 0.02), (2.0, 3.0, 0.01), (1.6, 2.9, 0.01)], PM)
P.cable('cable_lap', [(2.7, 1.8, DZ), (2.98, 1.85, 0.5), (3.08, 1.45, 0.02), (3.12, 1.3, 0.01), (3.13, 1.27, 0.15)], PM)   # along the wall to the socket
K.cube('power_strip', (0.32, 0.06, 0.04), (1.45, 3.05, 0.02), PM['ivory'], bev=0.006, rot=(0, 0, 4))
# --- the ceiling pendant: a dark industrial shade near the ceiling
K.cyl('pendant_rod', 0.006, 0.18, (1.7, 1.45, H - 0.09), PM['bp'], seg=8, bev=0)
pend = K.lathe('pendant_shade', [(0.0, 0.0), (0.05, 0.0), (0.12, -0.05), (0.2, -0.13), (0.198, -0.134), (0.118, -0.054), (0.0, -0.004)], (1.7, 1.45, H - 0.18), PM['bp_satin'])
K.cyl('pendant_bulb', 0.04, 0.05, (1.7, 1.45, H - 0.27), K.mat_plain('bulb_off', (0.9, 0.9, 0.88), rough=0.2, transmission=0.6), seg=16, bev=0)

# ================================================================= density pass 2 (zone by zone against the tutorial's frames)
RND = P.R
# desk, behind the monitors: the white drawer unit, file holders at both ends, a pen cup
P.desk_drawers((1.78, 3.13, DZ), 0, PM, scale=0.78)
P.file_holder((0.86, 3.04, DZ), 6, PM, color=(0.2, 0.3, 0.55)); P.file_holder((0.95, 3.04, DZ), 6, PM)
P.file_holder((2.6, 2.95, DZ), -4, PM, color=(0.12, 0.12, 0.13))
P.pen_cup((1.22, 2.98, DZ), PM)
# desk, the working surface: papers under the keyboard, snack packets, small boxes, a phone, a USB stick, a charger and
# its cable, a coiled cable, sticky notes, scissors, a green bowl, a document tray at the corner
P.paper_stack((1.86, 2.62, DZ), 5, PM, rz=-8, size=(0.3, 0.21))
for (x, y, rz_, row) in ((1.52, 2.57, 70, 2),):
    P.snack_packet((x, y, DZ), rz_, row)
for (x, y, rz_, row, sz) in ((2.99, 2.62, 15, 7, (0.09, 0.07, 0.11)), (1.04, 2.63, 30, 1, (0.08, 0.06, 0.05)), (2.2, 3.02, 5, 6, (0.07, 0.05, 0.1))):
    P.small_box((x, y, DZ), rz_, row, size=sz)
P.phone((2.42, 2.52, DZ), 18, PM)
P.usb_stick((2.02, 2.52, DZ), -30, PM); P.usb_stick((2.56, 2.88, DZ), 60, PM)
P.charger((1.5, 2.66, DZ + 0.003), 10, PM)
P.cable_coil((2.88, 2.97, DZ), PM)
P.sticky_notes((2.06, 2.56, DZ), 12, (0.86, 0.79, 0.45)); P.sticky_notes((2.7, 2.66, DZ), -20, (0.84, 0.7, 0.66), n=5)
P.scissors((2.75, 2.53, DZ + 0.002), 70, PM)
P.bowl((2.97, 2.52, DZ), (0.32, 0.5, 0.28), PM)
P.doc_tray((2.88, 2.25, DZ), 5, PM)
# the return: folders, a mug, a packet, a notepad
for k in range(3):
    K.cube('clear_folder', (0.24, 0.32, 0.002), (2.5 + k * 0.01, 2.02 + k * 0.012, DZ + 0.001 + k * 0.002), K.mat_plain(f'cfolder{k}', ((0.62, 0.66, 0.68), (0.7, 0.6, 0.52), (0.72, 0.7, 0.6))[k], rough=0.3, transmission=0.0), bev=0.0005, rot=(0, 0, 8 + k * 6))
P.mug('ret_mug', (2.4, 1.34, DZ), PM, 'ceramic_white')
P.snack_packet((2.92, 1.42, DZ), -15, 1)
# the left table and the wire rack: the scanner and router on the rack, a file holder and a bag on the table
P.scanner((0.31, 2.76, DESK_Z + 0.25 + 0.005), 0, PM)
P.router((0.2, 2.8, DESK_Z + 0.62 + 0.004), 0, PM)
P.file_holder((0.5, 2.95, DESK_Z), 90, PM)
P.small_box((0.5, 2.5, DESK_Z), 10, 2, size=(0.14, 0.1, 0.18))
# under the desk: a second product box, a magazine box, a paper bag, a shoebox of cables
K.cube('product_box2', (0.3, 0.2, 0.22), (2.68, 2.92, 0.11), P.label_mat(3), bev=0.003, rot=(0, 0, 6))
P.file_holder((1.25, 3.0, 0.0), 0, PM, color=(0.85, 0.85, 0.83))
P.paper_bag((0.98, 2.62, 0), 70, PM, h=0.26)
# floor: papers that slid off, a plastic bottle on its side
# walls: a calendar and a poster on the right wall above the binders, a framed print on the left wall
P.wall_print('calendar', os.path.join(P.ROOM_ASSETS, 'calendar.png'), (W - 0.006, 3.0, 1.45), (0.3, 0.42), rz=-90, frame=False)
P.wall_print('poster', os.path.join(P.ROOM_ASSETS, 'poster.png'), (W - 0.006, 2.15, 1.6), (0.36, 0.48), rz=-90, frame=True, M=PM)
P.wall_print('city_print', os.path.join(P.ROOM_ASSETS, 'print_city.png'), (0.006, 0.95, 1.55), (0.4, 0.3), rz=90, frame=True, M=PM)

# ================================================================= the back of the room (the walk-through turns to it): the door, the sofa corner
door_wood = K.mat_tex('door_wood', 'walnut', tile=0.9, tint=(0.55, 0.38, 0.28), rough_mul=0.4, rough_add=0.35)
K.cube('door_frame_l', (0.06, 0.1, 2.12), (1.78, 0.03, 1.06), door_wood, bev=0.004); K.cube('door_frame_r', (0.06, 0.1, 2.12), (2.7, 0.03, 1.06), door_wood, bev=0.004)
K.cube('door_frame_t', (0.98, 0.1, 0.06), (2.24, 0.03, 2.12), door_wood, bev=0.004)
K.cube('door_leaf', (0.86, 0.045, 2.06), (2.24, 0.03, 1.04), door_wood, bev=0.003)
K.cyl('door_handle', 0.009, 0.12, (2.56, 0.075, 1.0), PM['chrome'], rot=(0, 90, 0), seg=12)
K.cube('door_plate', (0.05, 0.008, 0.16), (2.58, 0.055, 1.0), PM['chrome'], bev=0.002)
P.wall_print('door_poster', os.path.join(P.ROOM_ASSETS, 'print_city.png'), (2.24, 0.06, 1.45), (0.32, 0.44), rz=180, frame=False)
K.cube('light_switch', (0.07, 0.012, 0.11), (2.85, 0.008, 1.2), PM['ivory'], bev=0.003)
# the sofa against the front wall, buried in the overflow: bags, boxes, a blue cooler, clothes, books on the floor round it
K.asset('Sofa_01', (0.95, 0.42, 0.0), rz=180, mat=K.mat_tex('sofa_leather', 'leather', tile=0.4, tint=(0.16, 0.1, 0.07), rough_mul=0.35, rough_add=0.25))
K.asset('cardboard_box_01', (1.35, 0.4, 0.42), rz=20, scale=1.1); K.asset('cardboard_box_01', (1.45, 0.75, 0.0), rz=-10, scale=1.2)
P.paper_bag((0.45, 0.85, 0), 60, PM, h=0.32)
for k in range(3):
    c = K.cube('clothes', (0.4, 0.3, 0.14), (0.95 + k * 0.12, 0.45 + k * 0.03, 0.52 + k * 0.05), K.mat_tex(f'cloth{k}', 'fabric_weave', tile=0.15, tint=((0.55, 0.6, 0.62), (0.2, 0.3, 0.45), (0.75, 0.72, 0.65))[k]), bev=0.0, rot=(0, 0, 25 * k))
    bv = c.modifiers.new('r', 'BEVEL'); bv.width = 0.05; bv.segments = 3; K.subsurf(c, 2)
    d = c.modifiers.new('fold', 'DISPLACE'); t = bpy.data.textures.get('folds') or bpy.data.textures.new('folds', 'CLOUDS'); t.noise_scale = 0.08; d.texture = t; d.strength = 0.04
P.book_stack((3.0, 1.35, 0.0), 9, PM, rz=12); P.book_stack((0.15, 0.45, 0.0), 6, PM, rz=-20)

# two cold drink cans (muted colours, satin aluminium), placed in clear space
for (x_, y_, c_) in ((1.12, 2.52, (0.32, 0.5, 0.52)), (2.98, 2.02, (0.8, 0.78, 0.72))):
    K.cyl('drink_can', 0.033, 0.122, (x_, y_, DZ + 0.061), K.mat_plain(f'can_{c_[0]}', c_, rough=0.32, metal=0.6, spec=0.45), seg=32, bev=0.003)
    K.cyl('drink_can_top', 0.029, 0.004, (x_, y_, DZ + 0.124), K.mat_plain('can_lid', (0.7, 0.71, 0.72), rough=0.3, metal=1.0), seg=24, bev=0.001)

# ================================================================= ceiling, aircon, clock
# the flush ceiling light: a dark drum with a white diffuser ring (as in the tutorial)
pass  # one ceiling fixture only (the pendant)
if False: K.cyl('ceil_lamp_rim', 0.26, 0.09, (1.8, 1.65, H - 0.045), M['black_plastic'], seg=48, bev=0.01)
if False: K.cyl('ceil_lamp_diffuser', 0.2, 0.012, (1.8, 1.65, H - 0.093), K.mat_emit('ceil_diffuser', K.kelvin(4200), 0.0 if LIGHT != 'night' else 0.0) if False else M['white_plastic'], seg=48, bev=0.004)
if False: K.cyl('ceil_lamp_center', 0.07, 0.016, (1.8, 1.65, H - 0.1), M['black_plastic'], seg=32, bev=0.004)
K.cube('aircon', (0.82, 0.24, 0.28), (0.13, 2.25, 2.2), M['white_plastic'], bev=0.04, seg=4, rot=(0, 0, 90))
K.cube('aircon_vent', (0.7, 0.02, 0.05), (0.25, 2.25, 2.1), M['black_plastic'], bev=0.005, rot=(0, 0, 90))
K.asset('wall_clock', (W - 0.03, 2.75, 2.02), rz=-90)   # the face looks into the room

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
fog_m = K.mat_emit('outside_fog', (0.82, 0.86, 0.9), 3.6 if LIGHT != 'night' else 0.0)
if LIGHT != 'night':   # mottled: an overcast street seen through frosted glass is never a flat white
    fn = fog_m.node_tree.nodes; em = [n for n in fn if n.type == 'EMISSION'][0]
    nz = fn.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.2; nz.inputs['Detail'].default_value = 4
    rp = fn.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (0.32, 0.34, 0.36, 1); rp.color_ramp.elements[1].color = (0.95, 0.97, 1.0, 1)
    fog_m.node_tree.links.new(nz.outputs['Fac'], rp.inputs[0]); fog_m.node_tree.links.new(rp.outputs[0], em.inputs[0])
outside = K.cube('outside', (12, 0.05, 6), (W / 2, DEP + 3.5, 1.5), fog_m, bev=0)
outside_l = K.cube('outside_l', (0.05, 12, 6), (-3.0, DEP / 2, 1.5), K.mat_emit('outside_fog_l', (0.82, 0.86, 0.9), 3.0 if LIGHT != 'night' else 0.0), bev=0)
for o in (outside, outside_l): o.visible_shadow = False
if LIGHT != 'night':
    for k_, x_ in enumerate((0.8, 1.85, 2.9)):
        K.lamp('AREA', f'window_key{k_}', (x_, DEP - 0.15, 1.55), float(opt('--key', '110')), (0.92, 0.96, 1.0), rot=(90, 0, 0), size=(1.0, 1.25))
    K.lamp('AREA', 'window_key_left', (0.15, (LEFT_WIN[0] + LEFT_WIN[1]) / 2, 1.55), float(opt('--key', '110')) * 0.7, (0.92, 0.96, 1.0), rot=(0, 90, 0), size=(1.3, 1.25))
if LIGHT in ('sun',):
    sun = K.lamp('SUN', 'sun', (0, 0, 10), 6.0, K.kelvin(5200), rot=(62, 0, 205), size=0.6)

# ================================================================= air (haze: shows the light through the blinds)
if '--novol' not in argv and LIGHT != 'night':
    v = bpy.data.materials.new('room_air'); v.use_nodes = True; vn = v.node_tree.nodes; vn.clear()
    pv = vn.new('ShaderNodeVolumePrincipled'); pv.inputs['Anisotropy'].default_value = 0.6
    # the air thickens toward the windows (the tutorial's milky light at the glass), thin over the room
    tco = vn.new('ShaderNodeTexCoord'); sxyz = vn.new('ShaderNodeSeparateXYZ'); v.node_tree.links.new(tco.outputs['Object'], sxyz.inputs[0])
    dmr = vn.new('ShaderNodeMapRange'); dmr.inputs['From Min'].default_value = 0.2; dmr.inputs['From Max'].default_value = DEP / 2
    dmr.inputs['To Min'].default_value = 0.018; dmr.inputs['To Max'].default_value = 0.045; dmr.interpolation_type = 'SMOOTHSTEP'
    v.node_tree.links.new(sxyz.outputs['Y'], dmr.inputs['Value']); v.node_tree.links.new(dmr.outputs['Result'], pv.inputs['Density'])
    vo = vn.new('ShaderNodeOutputMaterial'); v.node_tree.links.new(pv.outputs[0], vo.inputs['Volume'])
    air = K.cube('air', (W - 0.02, DEP - 0.02, H - 0.02), (W / 2, DEP / 2, H / 2), v, bev=0); air.visible_shadow = False

# ================================================================= camera
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); K.link(cam); sc.camera = cam
cam.data.sensor_width = 36
CAMS = {   # (location, look-at, lens mm, focus point or None, f-stop or None)
    'wide': ((1.74, 0.5, 1.56), (1.74, 3.3, 0.62), 16, None, None),                       # square to the window wall, from the door
    'desk': ((1.6, 1.55, 1.35), (2.2, 3.0, 0.8), 24, None, None),
    'chair': ((1.55, 1.05, 1.15), (0.84, 2.12, 0.72), 28, None, None),
    'wallcheck': ((1.6, 2.4, 1.7), (3.6, 2.4, 1.75), 24, None, None),     # the right wall: clock, calendar, poster
    # the stills set (2560x1440)
    'still_room': ((1.1, 0.35, 1.58), (2.0, 3.3, 0.85), 18, (1.9, 2.8, 0.9), 8),         # the room from the doorway
    'still_desk': ((1.8, 2.0, 1.28), (2.15, 2.78, 0.74), 24, (2.32, 2.6, 0.78), 3.5),     # high over the desk, the mug sharp
    'still_mug': ((2.05, 2.28, 0.98), (2.42, 2.72, 0.78), 35, (2.32, 2.6, 0.8), 2.0),     # low on the desk: mug, glass, tissue box
    'still_toys': ((2.3, 2.3, 1.24), (2.78, 3.05, 1.12), 40, (2.74, 2.95, 1.2), 2.4),     # the toys on the tower against the blinds
    'still_chair': ((2.2, 2.42, 1.22), (0.75, 1.92, 0.72), 22, (0.84, 2.12, 0.8), 4),      # the leather chair from the desk side, the rack, the left window
    'still_corner': ((2.1, 2.0, 1.5), (2.5, 0.1, 1.0), 20, (2.3, 0.3, 1.0), 6),          # the bookcase, the door, the sofa pile
}
loc, at, lens, fp, fs = CAMS[CAM]
cam.location = loc; cam.data.lens = lens
d = Vector(at) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
if fs:
    cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (Vector(fp) - Vector(loc)).length; cam.data.dof.aperture_fstop = fs
cam.data.clip_start = 0.02

# ================================================================= audit (--audit OUT_DIR): overlaps + an architectural plan, no film render
if '--audit' in argv:
    import mathutils
    adir = opt('--audit'); os.makedirs(adir, exist_ok=True)
    dg = bpy.context.evaluated_depsgraph_get()
    SKIP = ('wall', 'floor', 'ceiling', 'skirt', 'outside', 'air', 'sill', 'win_', 'portal', 'mass', 'cable', 'charger_cable', 'rack_', 'coil')
    boxes = []
    for o in K.coll('set').all_objects:
        if o.type not in ('MESH', 'CURVE') or o.name.startswith(SKIP): continue
        e = o.evaluated_get(dg); bb = [e.matrix_world @ mathutils.Vector(c) for c in e.bound_box]
        mn = mathutils.Vector(map(min, *bb)); mx = mathutils.Vector(map(max, *bb))
        top = o
        while top.parent: top = top.parent
        boxes.append((o.name, top.name, mn, mx))
    hits = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if a[1] == b[1] or a[0].split('_')[0] == b[0].split('_')[0]: continue      # parts of one object
            ov = [min(a[3][k], b[3][k]) - max(a[2][k], b[2][k]) for k in range(3)]
            if min(ov) > 0.015: hits.append((ov[0] * ov[1] * ov[2], a[0], b[0], [round(v, 3) for v in ov]))
    hits.sort(reverse=True)
    with open(os.path.join(adir, 'overlaps.txt'), 'w') as fh:
        for h in hits[:80]: fh.write(f"{h[1]:<28} x {h[2]:<28} overlap(m) {h[3]}\n")
    print('OVERLAPS', len(hits))
    # the plan: orthographic, straight down, ceiling and lamps hidden, flat even light
    for o in sc.objects:
        if o.name.startswith(('ceiling', 'ceil_lamp', 'pendant', 'aircon', 'air')): o.hide_render = True
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(W, DEP) + 0.6; cam.data.dof.use_dof = False
    cam.location = (W / 2, DEP / 2, 6.0); cam.rotation_euler = (0, 0, 0)
    sun = K.lamp('SUN', 'plan_sun', (0, 0, 10), 3.0, (1, 1, 1), rot=(0, 0, 0), size=8)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 1400; sc.view_settings.exposure = 0
    sc.render.filepath = os.path.join(adir, 'plan.png'); bpy.ops.render.render(write_still=True)
    # an isometric of the whole room from above the door corner, front walls hidden
    for o in sc.objects:
        if o.name.startswith(('wall_front', 'wall_right')): o.hide_render = True
    cam.data.ortho_scale = 6.2; cam.location = (W + 3.2, -3.2, 4.6)
    cam.rotation_euler = (Vector((W / 2, DEP / 2, 0.6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(adir, 'iso.png'); bpy.ops.render.render(write_still=True)
    raise SystemExit(0)

# ================================================================= render
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'; sc.cycles.denoising_prefilter = 'ACCURATE'
sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = float(opt('--noise', '0.015')); sc.cycles.adaptive_min_samples = 16
sc.render.use_persistent_data = True; sc.cycles.filter_width = 1.5
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 2; sc.cycles.transmission_bounces = 4
sc.cycles.volume_bounces = 1; sc.cycles.sample_clamp_indirect = 6; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.cycles.volume_step_rate = 3.0; sc.cycles.use_light_tree = True
sc.render.resolution_x, sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except TypeError: pass
sc.view_settings.exposure = float(opt('--exposure', '-0.95'))
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = OUT
if opt('--blend'): bpy.ops.wm.save_as_mainfile(filepath=opt('--blend'))
if opt('--film'):
    # the tutorial's film language: a handheld wide push, a slow slide across the desk, a close drift past the toys
    # the tutorial's camera: ONE handheld walk-through on a wide lens, operated at walking pace, whip pans with motion blur.
    # waypoints: (time s, camera position, look-at point); Catmull-Rom between them, plus layered hand shake
    # v2 (20 s, the tutorial's grammar): wide push -> low desk insert with a focus pull -> slide past the glass ->
    # rise to the toys -> pan to the window -> side wall -> whip to the bookcase -> door -> sofa -> whip back -> settle.
    # (time, camera, look-at, focus point or None = the look-at, f-stop)
    WP = [(0.0, (1.1, 0.35, 1.58), (2.0, 3.3, 0.85), None, 8),            # the room from the door
          (2.5, (1.42, 1.15, 1.48), (1.95, 3.3, 0.8), None, 8),            # push in past the chair
          (4.6, (1.8, 2.0, 1.28), (2.15, 2.78, 0.74), (2.32, 2.6, 0.78), 3.5),   # high over the desk looking down: focus on the mug
          (6.6, (2.2, 2.08, 1.2), (2.6, 2.85, 0.8), (2.58, 2.72, 0.8), 3.5),   # slide past the glass of tea
          (8.4, (2.3, 2.3, 1.24), (2.78, 3.05, 1.12), (2.74, 2.95, 1.2), 3.2),    # rise to the toys on the tower
          (10.0, (2.3, 2.25, 1.32), (2.4, 3.3, 1.25), None, 5),           # lift to the blinds and the window light
          (11.6, (2.25, 2.0, 1.5), (3.6, 2.6, 1.6), None, 8),              # the side wall: clock, calendar, poster
          (13.0, (2.2, 1.8, 1.5), (3.6, 0.8, 1.15), None, 8),              # the bookcase
          (14.4, (2.05, 1.6, 1.52), (2.24, 0.0, 1.2), None, 8),            # the door and its poster
          (16.0, (1.8, 1.5, 1.5), (0.9, 0.4, 0.55), None, 8),              # down to the sofa buried in boxes
          (17.6, (1.65, 1.4, 1.55), (0.4, 2.6, 1.2), None, 8),             # whip back: the rack and the left window
          (20.0, (1.6, 1.05, 1.6), (1.9, 3.3, 0.85), None, 8)]             # settle on the room
    WP = [(t, c, l, fp if fp else l, fs) for (t, c, l, fp, fs) in WP]
    def cr(p0, p1, p2, p3, u):
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    def along(t, k):
        for i in range(len(WP) - 1):
            if WP[i][0] <= t <= WP[i + 1][0]:
                u = (t - WP[i][0]) / (WP[i + 1][0] - WP[i][0]); u = u * u * (3 - 2 * u) * 0.5 + u * 0.5
                P_ = [Vector(WP[max(0, j)][k]) for j in (i - 1, i, i + 1, min(i + 2, len(WP) - 1))]
                return cr(*P_, u)
        return Vector(WP[-1][k])
    n = int(WP[-1][0] * 24)
    sc.frame_start = 1; sc.frame_end = n; sc.render.fps = 24
    sc.render.use_overwrite = False; sc.render.use_placeholder = True
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5      # the whip pans smear like a real camera
    cam.data.lens = 18; cam.data.dof.use_dof = True
    focus = bpy.data.objects.new('focus', None); K.link(focus); cam.data.dof.focus_object = focus
    def fstop(t):
        for i in range(len(WP) - 1):
            if WP[i][0] <= t <= WP[i + 1][0]:
                u = (t - WP[i][0]) / (WP[i + 1][0] - WP[i][0]); u = u * u * (3 - 2 * u); return WP[i][4] + (WP[i + 1][4] - WP[i][4]) * u
        return WP[-1][4]
    for f in range(1, n + 1):
        t = (f - 1) / 24
        shake = Vector((math.sin(t * 6.1) * 0.006 + math.sin(t * 13.7 + 1) * 0.003, math.sin(t * 5.3 + 2) * 0.005, math.sin(t * 7.9) * 0.007 + math.sin(t * 2.2) * 0.004))
        cam.location = along(t, 1) + shake
        look = along(t, 2) + Vector((math.sin(t * 3.1) * 0.02, 0, math.sin(t * 4.3 + 1) * 0.015))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.rotation_euler.y += math.sin(t * 2.7) * 0.012
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        focus.location = along(t, 3); focus.keyframe_insert('location', frame=f)
        cam.data.dof.aperture_fstop = fstop(t); cam.data.dof.keyframe_insert('aperture_fstop', frame=f)
        cam.data.lens = 18 + 6 * max(0.0, (8 - fstop(t)) / 5.2); cam.data.keyframe_insert('lens', frame=f)   # inserts go a touch longer
    if opt('--range'): sc.frame_start, sc.frame_end = map(int, opt('--range').split('-'))
    sc.frame_step = int(opt('--step', '1'))       # render every Nth frame; the encode interpolates motion back to 24 fps
    sc.render.filepath = OUT.rstrip('/') + '/f_'
    bpy.ops.render.render(animation=True)
elif opt('--anim'):
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
