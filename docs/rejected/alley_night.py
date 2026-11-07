"""THE BACK ALLEY, 2 AM: the AAA environment study, built the tutorial's way.

Real assets, real light: Poly Haven CC0 kits and props (blender/assets/props/), Poly Haven textures and HDRI
(blender/assets/alley/), path-traced in Cycles with volumetric air.

The frame (one idea): a narrow alley at 2 am in cold blue fog. Halfway down on the left, a workshop's roller
shutter is half up and the only warm light in the world spills out under it, across wet asphalt. Everything
else is cold: a mercury wall lamp, a security light, a street lamp in the fog at the far end.
(The director's taste: a large cold field, one small hot accent, light with visible air, wet ground in places,
foreground framing, depth layers into fog. Matte by default; wet only where water would lie.)

    blender -b --factory-startup --python blender/scenes/alley_night.py -- OUT.png [--res 960x540] [--samples 64]
        [--clay] (grey materials: read form and light) [--blend file.blend] [--cam name]
Fetch the assets first: node tools/polyhaven.mjs --res 1k <ids in PROPS below> (and the textures/HDRI: see STUDIES.md).
"""
import bpy, sys, os, glob, math
from mathutils import Vector, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PROPS = os.path.join(ROOT, 'blender', 'assets', 'props')
ALLEY = os.path.join(ROOT, 'blender', 'assets', 'alley')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv and not argv[0].startswith('--') else '/tmp/alley.png'
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
RES = tuple(map(int, opt('--res', '960x540').split('x')))
SAMPLES = int(opt('--samples', '64'))
CLAY = '--clay' in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
D = bpy.data

# ---------------------------------------------------------------- helpers
def coll(name):
    c = D.collections.new(name); sc.collection.children.link(c); return c

LIB = coll('_lib'); LIB.hide_render = True; LIB.hide_viewport = True
SET = coll('set')
_imported = {}

def load(asset):
    """Import a Poly Haven glTF once into the hidden library; return {piece name: object}."""
    if asset in _imported: return _imported[asset]
    before = set(D.objects)
    bpy.ops.import_scene.gltf(filepath=glob.glob(os.path.join(PROPS, asset, '*.gltf'))[0])
    new = [o for o in D.objects if o not in before]
    for o in new:
        for c in o.users_collection: c.objects.unlink(o)
        LIB.objects.link(o)
    _imported[asset] = {o.name.split('.')[0]: o for o in new if o.type == 'MESH'}
    return _imported[asset]

def place(asset, piece, loc, rz=0.0, scale=1.0, rx=0.0, ry=0.0, parent_coll=SET):
    """A linked duplicate of one library piece (shares the mesh), at loc with a rotation (degrees)."""
    src = load(asset)[piece]
    o = D.objects.new(piece, src.data)
    o.location = loc; o.rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)))
    o.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    parent_coll.objects.link(o)
    return o

def place_all(asset, loc, rz=0.0, scale=1.0, skip=(), only=None):
    """A whole prop (all its pieces), keeping their relative layout."""
    out = []
    for name, src in load(asset).items():
        if any(s in name for s in skip) or (only and not any(s in name for s in only)): continue
        o = D.objects.new(name, src.data)
        m = Euler((0, 0, math.radians(rz))).to_matrix().to_4x4()
        o.matrix_world = (Matrix_T(loc) @ m @ Matrix_S(scale)) @ src.matrix_world
        SET.objects.link(o); out.append(o)
    return out

from mathutils import Matrix
Matrix_T = lambda v: Matrix.Translation(Vector(v))
Matrix_S = lambda s: Matrix.Diagonal((s, s, s, 1))

def tex_mat(name, folder, tile=2.0, rough_mul=1.0, tint=(1, 1, 1), wet=None, bump=1.0):
    """A PBR material from a Poly Haven set, mapped in world metres (constant scale on any mesh).
    wet: a noise-masked puddle layer (water lies in the low spots): {'scale', 'cover'}."""
    m = D.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); bs = N.new('ShaderNodeBsdfPrincipled'); L.new(bs.outputs[0], out.inputs[0])
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile,) * 3
    L.new(tc.outputs['Object'], mp.inputs[0])
    def img(fn, col):
        t = N.new('ShaderNodeTexImage'); t.image = D.images.load(os.path.join(folder, fn), check_existing=True)
        t.projection = 'BOX'; t.projection_blend = 0.25
        if not col: t.image.colorspace_settings.name = 'Non-Color'
        L.new(mp.outputs[0], t.inputs[0]); return t
    alb = img('albedo.jpg', True); rough = img('rough.jpg', False); nor = img('normal.jpg', False)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    L.new(alb.outputs[0], mix.inputs['A']); mix.inputs['B'].default_value = (*tint, 1)
    rm = N.new('ShaderNodeMath'); rm.operation = 'MULTIPLY'; rm.inputs[1].default_value = rough_mul; L.new(rough.outputs[0], rm.inputs[0])
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = bump; L.new(nor.outputs[0], nm.inputs['Color'])
    col_out, rough_out, nor_out = mix.outputs['Result'], rm.outputs[0], nm.outputs[0]
    if wet:
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = wet['scale']; nz.inputs['Detail'].default_value = 6
        L.new(tc.outputs['Object'], nz.inputs['Vector'])
        ramp = N.new('ShaderNodeMapRange'); ramp.inputs['From Min'].default_value = wet['cover']; ramp.inputs['From Max'].default_value = wet['cover'] + 0.04
        L.new(nz.outputs['Fac'], ramp.inputs['Value'])
        # puddle: darker, nearly mirror, flat (the water levels the bumps)
        dark = N.new('ShaderNodeMix'); dark.data_type = 'RGBA'; dark.blend_type = 'MULTIPLY'
        L.new(ramp.outputs[0], dark.inputs['Factor']); L.new(col_out, dark.inputs['A']); dark.inputs['B'].default_value = (0.35, 0.36, 0.38, 1)
        rr = N.new('ShaderNodeMix'); rr.data_type = 'FLOAT'; L.new(ramp.outputs[0], rr.inputs['Factor']); L.new(rough_out, rr.inputs['A']); rr.inputs['B'].default_value = 0.03
        nn = N.new('ShaderNodeMix'); nn.data_type = 'VECTOR'; L.new(ramp.outputs[0], nn.inputs['Factor']); L.new(nor_out, nn.inputs['A'])
        gn = N.new('ShaderNodeNewGeometry'); L.new(gn.outputs['Normal'], nn.inputs['B'])
        col_out, rough_out, nor_out = dark.outputs['Result'], rr.outputs['Result'], nn.outputs['Result']
    L.new(col_out, bs.inputs['Base Color']); L.new(rough_out, bs.inputs['Roughness']); L.new(nor_out, bs.inputs['Normal'])
    return m

def box(name, size, loc, mat, rz=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size; o.rotation_euler.z = math.radians(rz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for c in o.users_collection: c.objects.unlink(o)
    SET.objects.link(o); o.data.materials.append(mat); return o

def emit_mat(name, color, strength):
    m = D.materials.new(name); m.use_nodes = True; N = m.node_tree.nodes; N.clear()
    e = N.new('ShaderNodeEmission'); e.inputs[0].default_value = (*color, 1); e.inputs[1].default_value = strength
    o = N.new('ShaderNodeOutputMaterial'); m.node_tree.links.new(e.outputs[0], o.inputs[0]); return m

def light(kind, name, loc, energy, color, rot=(0, 0, 0), size=0.1, spot=None, blend=0.3, shadow_soft=None):
    l = D.lights.new(name, kind); l.energy = energy; l.color = color
    if kind == 'AREA': l.shape = 'RECTANGLE'; l.size, l.size_y = size if isinstance(size, tuple) else (size, size)
    elif kind in ('POINT', 'SPOT'): l.shadow_soft_size = size
    if kind == 'SPOT': l.spot_size = math.radians(spot or 70); l.spot_blend = blend
    o = D.objects.new(name, l); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot]); SET.objects.link(o); return o

def kelvin(k):   # blackbody approximation -> linear RGB, good enough for practicals
    t = k / 100.0
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.04)
    return tuple(max(0, min(255, c)) / 255.0 for c in (r, g, b))

# ---------------------------------------------------------------- materials
TEX = os.path.join(ALLEY, 'tex')
M_ROAD = tex_mat('alley_asphalt', os.path.join(TEX, 'road_damaged'), tile=3.0, rough_mul=0.95, tint=(0.8, 0.8, 0.82), wet={'scale': 0.3, 'cover': 0.5}, bump=0.8)
M_CURB = tex_mat('curb_concrete', os.path.join(TEX, 'dirty_concrete'), tile=1.5, tint=(0.75, 0.75, 0.75), wet={'scale': 0.8, 'cover': 0.6})
M_CONC = tex_mat('concrete_wall', os.path.join(TEX, 'concrete_wall_008'), tile=3.0, tint=(0.55, 0.55, 0.57))
M_INNER = tex_mat('workshop_wall', os.path.join(TEX, 'concrete_wall_008'), tile=2.0, tint=(0.62, 0.6, 0.57))
M_RUST = tex_mat('rust', os.path.join(TEX, 'rusty_metal_02'), tile=1.0)
M_DARK = D.materials.new('building_mass'); M_DARK.use_nodes = True
M_DARK.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.022, 1)
M_DARK.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9

# ---------------------------------------------------------------- the buildings (Poly Haven modular kits, assembled on their 3 m grid)
FX, AP = 'modular_factory_facade', 'modular_urban_apartments_facade'
XL, XR = -3.2, 3.2            # the two facades; the alley is 6.4 m wide
Y0, Y1 = -6.0, 30.0           # the alley's length in view

def facade(kit, side, ground, upper, floors, belt, crown, base='base_standard_standard_01'):
    """side 'L': x = XL facing +x; 'R': x = XR facing -x. ground/upper: lists of (wall, piece or None, width)."""
    rz = 90 if side == 'L' else -90
    x = XL if side == 'L' else XR
    for f in range(floors):
        mods = ground if f == 0 else upper[(f - 1) % len(upper)]
        y = Y0
        for wall, piece, w in mods:
            oy = y + w if side == 'L' else y   # the piece's origin is its right edge
            place(kit, wall, (x, oy, 3.0 * f), rz)
            if piece: place(kit, piece, (x, oy, 3.0 * f), rz)
            if f == 0 and base and w == 3: place(kit, base, (x, oy, 0), rz)
            if f >= 1 and belt: place(kit, belt, (x, oy, 3.0 * f - 0.08), rz)
            if f == floors - 1 and crown: place(kit, crown, (x, oy, 3.0 * floors), rz)
            y += w
    # the building's mass behind the facade, so windows show a dark interior and the roofline reads
    depth = 12
    gap = 6.2 if side == 'L' else 0.35      # the left block keeps room for the workshop behind the shutter
    cx = x - depth / 2 - gap if side == 'L' else x + depth / 2 + gap
    box(f'mass_{side}', (depth, Y1 - Y0, 3.0 * floors + 0.3), (cx, (Y0 + Y1) / 2, 1.5 * floors), M_DARK)

S = lambda: ('wall_standard_standard_01', None, 3)
# left: the brick workshop. Ground floor: a recessed door, the half-open garage (the warm heart of the frame),
# a steel door, then plain brick and a double garage at the far end
L_GROUND = [S(), ('wall_door_recessed_small_01', 'door_recessed_small_01', 3), S(), ('wall_door_garage_door_01', 'door_garage_door_01', 6),
            ('wall_door_centered_small_01', 'door_centered_small_01', 3), S(), ('wall_door_garage_double_01', 'door_garage_double_01', 9), S(), S()]
def fx_row(v):
    return [(f'wall_window_centered_medium_0{v}', f'window_centered_medium_0{v}', 3), (f'wall_window_centered_large_0{v}', f'window_centered_large_0{v}', 3)] * 6
facade(FX, 'L', L_GROUND, [fx_row(1), fx_row(2), fx_row(3)], 4, 'cornice01_standard_standard_01', 'crown_standard_standard_01')

# right: the apartment block. Ground floor: shopfront doors (one shuttered), upper floors: sash windows
R_GROUND = [S(), ('wall_door_centered_large_01', 'door_centered_large_01', 3), S(), S(), ('wall_door_centered_small_01', 'door_centered_small_01', 3),
            S(), S(), ('wall_door_centered_small_02', 'door_centered_small_02', 3), S(), S(), S(), S()]
def ap_row(v):
    return [(f'wall_window_centered_double_0{v}', f'window_centered_double_0{v}', 3), (f'wall_window_centered_small_0{v}', f'window_centered_small_0{v}', 3),
            (f'wall_window_centered_large_0{v}', f'window_centered_large_0{v}', 3)] * 4
facade(AP, 'R', R_GROUND, [ap_row(1), ap_row(2), ap_row(3)], 5, 'cornice_standard_standard_01', 'crown_standard_standard_01', base='base_standard_01')

# the far side of the cross street: another apartment front facing us, closing the view
for k in range(8):
    x = -10.5 + 3 * k + 3
    for f in range(4):
        wall, piece = (('wall_standard_standard_01', None) if f == 0 and k % 3 else ('wall_door_centered_large_01', 'door_centered_large_01')) if f == 0 else \
            (f'wall_window_centered_double_0{f}', f'window_centered_double_0{f}')
        place(AP, wall, (x, Y1 + 9, 3.0 * f)); place(AP, piece, (x, Y1 + 9, 3.0 * f)) if piece else None
    place(AP, 'crown_standard_standard_01', (x, Y1 + 9, 12.0))
box('mass_far', (30, 10, 12.3), (0, Y1 + 14.4, 6.1), M_DARK)

# ---------------------------------------------------------------- ground: asphalt with puddles, curbs along both walls, the cross street
box('alley_floor', (60, 80, 0.2), (0, 12, -0.1), M_ROAD)
box('curb_L', (0.55, Y1 - Y0, 0.14), (XL + 0.28, (Y0 + Y1) / 2, 0.07), M_CURB)
box('curb_R', (0.55, Y1 - Y0, 0.14), (XR - 0.28, (Y0 + Y1) / 2, 0.07), M_CURB)
box('kerb_far', (40, 0.4, 0.14), (0, Y1 + 8.3, 0.07), M_CURB)

# ---------------------------------------------------------------- the workshop behind the half-open shutter (the warm heart)
GAR_Y = Y0 + 9          # the garage module spans y 3..9 on the left wall
gar_door = [o for o in SET.objects if o.name.startswith('door_garage_door_01')][0]
top = 2.74
GAP = 0.95                                                               # the shutter is down to 0.95 m: light spills out under it
gar_door.scale.z = (top - GAP) / top; gar_door.location.z += GAP
box('shop_floor', (6, 5.4, 0.05), (XL - 3.0, GAR_Y + 3, 0.02), M_CURB)
box('shop_back', (0.2, 5.6, 3.0), (XL - 5.6, GAR_Y + 3, 1.5), M_INNER)
box('shop_side_a', (5.6, 0.2, 3.0), (XL - 2.8, GAR_Y + 0.1, 1.5), M_INNER)
box('shop_side_b', (5.6, 0.2, 3.0), (XL - 2.8, GAR_Y + 5.9, 1.5), M_INNER)
box('shop_ceiling', (5.6, 5.8, 0.15), (XL - 2.8, GAR_Y + 3, 2.95), M_CONC)
# a working motorbike shop, seen only from the knees down under the shutter: the bench and vice on the back wall,
# shelving with crates, the welding cart mid-floor (someone is welding), a tool chest, cans, a ladder against the wall
BX = XL - 5.35
for yy in (GAR_Y + 0.9, GAR_Y + 2.05):
    place_all('steel_frame_shelves_01', (BX + 0.05, yy, 0.04), rz=90, scale=0.1)
for (yy, zz, r) in [(GAR_Y + 0.7, 0.05, 10), (GAR_Y + 1.1, 0.05, -8), (GAR_Y + 2.2, 0.05, 4), (GAR_Y + 0.9, 0.31, 20)]:
    place_all('plastic_crate_01', (BX + 0.1, yy, zz), rz=r)
place_all('WoodenTable_03', (BX, GAR_Y + 3.9, 0.04), rz=90)
place_all('bench_vice_01', (BX + 0.05, GAR_Y + 3.6, 0.87), rz=90, skip=('Icosphere',))
place_all('metal_tool_chest', (BX + 0.1, GAR_Y + 4.9, 0.04), rz=80)
place_all('portable_welding_cart', (XL - 3.1, GAR_Y + 3.5, 0.04), rz=-30)
place_all('industrial_storage_cart', (XL - 2.0, GAR_Y + 1.3, 0.04), rz=8)
place_all('metal_jerrycan', (XL - 1.0, GAR_Y + 5.1, 0.04), rz=40); place_all('metal_jerrycan', (XL - 1.25, GAR_Y + 5.25, 0.04), rz=-10)
place_all('ladder_sectioned_01', (XL - 4.2, GAR_Y + 5.75, 0.04), rz=0, skip=())
place_all('barrel_stove', (XL - 1.0, GAR_Y + 0.6, 0.04))
place_all('old_tyre', (XL - 0.7, GAR_Y + 4.2, 0.3), rz=95)
place_all('caged_hanging_light', (XL - 3.2, GAR_Y + 3.4, 2.95))
bulb = box('bulb', (0.07, 0.07, 0.1), (XL - 3.2, GAR_Y + 3.4, 2.32), emit_mat('bulb_hot', kelvin(2200), 60))

# ---------------------------------------------------------------- dressing with intent (big to small, clustered where people live)
place_all('covered_car', (XR - 1.25, 9.0, 0.0), rz=0)                                   # parked tight to the right wall
place_all('metal_trash_can', (XR - 0.62, 1.4, 0.14), rz=-90, skip=('rust',))            # the bins by the first door
place_all('cardboard_box_01', (XR - 0.55, 3.2, 0.14), rz=10); place_all('cardboard_box_01', (XR - 0.6, 3.1, 0.48), rz=-25)
place_all('old_tyre', (XR - 0.45, 4.1, 0.31), rz=-80)
place_all('street_rat', (XR - 1.0, 2.6, 0.14), rz=200, scale=1.0)
place_all('water_manhole_cover', (0.4, 5.5, 0.01))
place_all('utility_box_02', (XL + 0.22, -1.2, 0.14), rz=-90)                            # meters on the brick
place_all('utility_box_01', (XL + 0.22, 0.2, 0.14), rz=-90)
place_all('spray_paint_bottles_02', (XL + 0.5, 0.9, 0.14), rz=30)
place_all('concrete_road_barrier', (-1.6, Y1 - 1.0, 0.0), rz=8)                         # the alley's end, half blocked
place_all('concrete_road_barrier', (0.3, Y1 - 0.6, 0.0), rz=-4)
place_all('fire_hydrant', (XR + 0.05, 13.0, 0.75), rz=-90, skip=('aged',))              # the wall hydrant
for i, (yy, zz) in enumerate([(2.0, 3.9), (7.5, 6.9), (15.0, 3.9), (21.0, 9.9)]):      # aircon units under the windows, right block
    place_all('exterior_aircon_unit', (XR - 0.18, yy, zz), rz=-90, skip=('rusted',) if i % 2 else ('exterior_aircon_unit',), only=None)
place_all('modular_fire_escape', (XR - 0.75, 18.5, 6.0), rz=-90)                        # fire escape over the second door
place_all('security_light', (XR - 0.05, 19.5, 2.8), rz=-90)
place_all('street_lamp_02', (XL + 0.05, -0.5, 4.2), rz=90)                             # the mercury lamp on the brick
place_all('street_lamp_01', (-5.5, Y1 + 6.5, 0.14))                                     # the street lamp across the road
place_all('street_lamp_01', (7.0, Y1 + 6.5, 0.14))

# ---------------------------------------------------------------- light, in layers: sky -> practicals -> the warm key -> air
w = D.worlds.new('night'); sc.world = w; w.use_nodes = True
wn = w.node_tree.nodes; env = wn.new('ShaderNodeTexEnvironment'); env.image = D.images.load(os.path.join(ALLEY, 'hdri', 'narrow_moonlit_road_2k.hdr'))
w.node_tree.links.new(env.outputs[0], wn['Background'].inputs[0]); wn['Background'].inputs[1].default_value = 0.35
# what the lens sees above the roofs: a clean night sky (deep blue, lighter toward the city's glow), not the HDRI's trees
lp = wn.new('ShaderNodeLightPath'); sky = wn.new('ShaderNodeBackground'); grad = wn.new('ShaderNodeTexCoord'); sxyz = wn.new('ShaderNodeSeparateXYZ')
w.node_tree.links.new(grad.outputs['Generated'], sxyz.inputs[0])
sr = wn.new('ShaderNodeValToRGB'); sr.color_ramp.elements[0].position = 0.5; sr.color_ramp.elements[0].color = (0.035, 0.06, 0.11, 1)
sr.color_ramp.elements[1].position = 0.75; sr.color_ramp.elements[1].color = (0.006, 0.01, 0.022, 1)
w.node_tree.links.new(sxyz.outputs['Z'], sr.inputs[0]); w.node_tree.links.new(sr.outputs[0], sky.inputs[0]); sky.inputs[1].default_value = 1.0
mixw = wn.new('ShaderNodeMixShader'); w.node_tree.links.new(lp.outputs['Is Camera Ray'], mixw.inputs[0])
w.node_tree.links.new(wn['Background'].outputs[0], mixw.inputs[1]); w.node_tree.links.new(sky.outputs[0], mixw.inputs[2])
w.node_tree.links.new(mixw.outputs[0], wn['World Output'].inputs[0])
moon = light('SUN', 'moon', (0, 0, 30), 0.25, (0.62, 0.74, 1.0), rot=(38, -18, 30)); moon.data.angle = math.radians(2)
# the workshop: one big warm soft source in the ceiling + the bare bulb; the spill under the shutter is the key of the frame
light('AREA', 'workshop_fill', (XL - 2.6, GAR_Y + 3.0, 2.85), 220, kelvin(2700), rot=(0, 0, 0), size=(4.0, 4.5))
light('POINT', 'caged_bulb', (XL - 3.2, GAR_Y + 3.4, 2.3), 650, kelvin(2500), size=0.05)          # the pool on the floor: the key
light('AREA', 'spill_bounce', (XL - 0.3, GAR_Y + 3.0, 0.6), 160, kelvin(2000), rot=(0, 90, 0), size=(1.0, 5.2))   # the floor inside bouncing out
# cold practicals
light('SPOT', 'mercury_lamp', (XL + 0.95, -0.5, 4.05), 420, (0.62, 0.86, 1.0), spot=95, blend=0.6, size=0.08)
lamp_mat = emit_mat('lamp_glow_cold', (0.7, 0.9, 1.0), 30)
box('mercury_bulb', (0.18, 0.18, 0.04), (XL + 0.95, -0.5, 4.08), lamp_mat)
light('SPOT', 'security', (XR - 0.4, 19.5, 2.65), 260, (0.85, 0.92, 1.0), rot=(-55, 0, -90), spot=80, blend=0.5, size=0.06)
for x in (-5.0, 6.5):
    light('SPOT', f'street_{x}', (x + 0.3, Y1 + 6.5, 3.75), 2200, (0.75, 0.88, 1.0), spot=110, blend=0.7, size=0.1)
    box(f'street_head_{x}', (0.35, 0.2, 0.05), (x + 0.3, Y1 + 6.5, 3.8), emit_mat('street_glow', (0.75, 0.88, 1.0), 40))
# the right block: a cold fluorescent porch fixture over its first door, and the city's glow bouncing off the brick opposite
light('AREA', 'porch', (XR - 0.25, -1.5, 3.05), 140, (0.82, 1.0, 0.92), rot=(0, -90, 0), size=(0.6, 0.12))
box('porch_tube', (0.06, 0.6, 0.06), (XR - 0.12, -1.5, 3.05), emit_mat('porch_glow', (0.82, 1.0, 0.92), 25))
light('AREA', 'city_bounce', (XL + 0.5, 12.0, 9.0), 1600, (0.55, 0.68, 1.0), rot=(0, 70, 0), size=(8.0, 30.0))
# a few lived-in windows (warm, dim) and one TV (cool), so the blocks are homes, not walls
for (xx, yy, zz, col, s) in [(XR + 0.6, 4.5, 4.4, kelvin(2600), 3), (XR + 0.6, 13.5, 7.4, (0.5, 0.65, 1.0), 2), (XR + 0.6, 22.5, 10.4, kelvin(2700), 2.5),
                             (XL - 0.6, 16.5, 7.4, kelvin(2400), 2), (-4.5, Y1 + 9.6, 4.4, kelvin(2700), 3), (5.5, Y1 + 9.6, 7.4, kelvin(2600), 2)]:
    o = box('window_room', (0.05, 2.2, 1.8), (xx, yy, zz), emit_mat('room_glow', col, s), rz=0 if abs(xx) > 3 and yy < Y1 else 90)
# air: a thin blue fog over the whole alley (shows the light), denser low down
vol = D.materials.new('alley_air'); vol.use_nodes = True; vn = vol.node_tree.nodes; vn.clear()
pv = vn.new('ShaderNodeVolumePrincipled'); pv.inputs['Color'].default_value = (0.55, 0.68, 0.9, 1); pv.inputs['Anisotropy'].default_value = 0.45
grad = vn.new('ShaderNodeTexCoord'); sep = vn.new('ShaderNodeSeparateXYZ'); vol.node_tree.links.new(grad.outputs['Object'], sep.inputs[0])
fall = vn.new('ShaderNodeMapRange'); fall.inputs['From Min'].default_value = -0.5; fall.inputs['From Max'].default_value = 0.5
fall.inputs['To Min'].default_value = 0.022; fall.inputs['To Max'].default_value = 0.005
vol.node_tree.links.new(sep.outputs['Z'], fall.inputs['Value']); vol.node_tree.links.new(fall.outputs[0], pv.inputs['Density'])
vo = vn.new('ShaderNodeOutputMaterial'); vol.node_tree.links.new(pv.outputs[0], vo.inputs['Volume'])
if '--novol' not in argv:
    air = box('air', (24, 60, 16), (0, 14, 8), vol); air.visible_shadow = True

# ---------------------------------------------------------------- camera
cam = D.objects.new('cam', D.cameras.new('cam')); SET.objects.link(cam); sc.camera = cam
cam.data.lens = 24; cam.data.sensor_width = 36
cam.location = (0.9, -4.6, 1.55); cam.rotation_euler = Euler((math.radians(92.5), 0, math.radians(3.0)))
if opt('--camxyz'):
    v = list(map(float, opt('--camxyz').split(','))); cam.location = v[:3]; cam.rotation_euler = Euler((math.radians(v[3]), 0, math.radians(v[4])))
    if len(v) > 5: cam.data.lens = v[5]
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = 12; cam.data.dof.aperture_fstop = 4.0

# ---------------------------------------------------------------- clay (form + light only)
if CLAY:
    clay = D.materials.new('clay'); clay.use_nodes = True; clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
    for o in SET.objects:
        if o.type == 'MESH' and o.name not in ('air',) and not any(m and 'glow' in m.name for m in o.data.materials):
            o.data.materials.clear() if o.data.users == 1 else None
            o.material_slots and [setattr(s, 'link', 'OBJECT') or setattr(s, 'material', clay) for s in o.material_slots]

# ---------------------------------------------------------------- render
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 8; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3; sc.cycles.volume_bounces = 1
sc.cycles.sample_clamp_indirect = 8; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.cycles.volume_step_rate = 4.0; sc.cycles.use_light_tree = True
sc.render.resolution_x, sc.render.resolution_y = RES; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except TypeError as e: print('look not set', e)
sc.view_settings.exposure = float(opt('--exposure', '0.0'))
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = OUT
if opt('--blend'): bpy.ops.wm.save_as_mainfile(filepath=opt('--blend'))
bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
