"""Background passengers for Last Train v3: the same pipeline as Noor (CC0 Quaternius base body, our own outfits,
seated IK pose, a small idle loop) driven by presets. Original designs.

    python3 blender/characters/ps1_passenger.py --textures <quaternius_dir>          (paint the outfit textures; system python)
    blender -b --factory-startup --python blender/characters/ps1_passenger.py -- <quaternius_dir> <preset> <out.glb> [--preview p.png --t 2]
Presets: commuter (teal hoodie, head down over a phone), reader (beige coat, a book in her lap), sleeper (navy suit, asleep).
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TEXOUT = os.path.join(ROOT, 'engine', 'studies', 'ps1-subway-v3', 'assets')

PRESETS = {
    'commuter': {'base': 'Male', 'hair': 'Hair_Buzzed', 'skin': 'T_Superhero_Male_Dark.png',
                 'top': (32, 98, 104), 'top_line': (20, 70, 76), 'legs': (70, 72, 78), 'shoe': (28, 28, 30),
                 'feet': ((0.17, -0.5), (-0.17, -0.48)), 'hands': ((0.06, -0.38, 0.62), (-0.06, -0.38, 0.62)), 'lean': 14,
                 'head': [(0, (22, 0, 0)), (4, (24, -4, 0)), (8, (20, 3, 0)), (12, (22, 0, 0))], 'prop': 'phone'},
    'reader':   {'base': 'Female', 'hair': 'Hair_Buns', 'skin': 'T_Superhero_Female_Dark_BaseColor.png',
                 'top': (188, 168, 128), 'top_line': (150, 132, 98), 'legs': (30, 30, 34), 'shoe': (60, 40, 30),
                 'feet': ((0.07, -0.52), (-0.07, -0.52)), 'hands': ((0.08, -0.36, 0.56), (-0.08, -0.36, 0.56)), 'lean': 10,
                 'head': [(0, (18, 0, 0)), (5, (18, 2, 0)), (5.4, (16, -2, 0)), (12, (18, 0, 0))], 'prop': 'book'},
    'sleeper':  {'base': 'Male', 'hair': 'Hair_SimpleParted', 'skin': 'T_Superhero_Male_Ligh.png',
                 'top': (32, 40, 64), 'top_line': (22, 28, 46), 'legs': (32, 40, 64), 'shoe': (20, 16, 14),
                 'feet': ((0.2, -0.56), (-0.18, -0.55)), 'hands': ((0.1, -0.3, 0.5), (-0.1, -0.3, 0.5)), 'lean': -8,
                 'head': [(0, (-14, 0, 18)), (6, (-12, 0, 20)), (12, (-14, 0, 18))], 'prop': None},
}

# ---------------------------------------------------------------- textures (system python)
if '--textures' in sys.argv:
    from PIL import Image, ImageDraw
    import random
    QD = sys.argv[sys.argv.index('--textures') + 1]; os.makedirs(TEXOUT, exist_ok=True); R = random.Random(8)
    def quilt(base, line, step=10):
        im = Image.new('RGB', (64, 64), base); d = ImageDraw.Draw(im)
        for y in range(0, 64, step): d.line([0, y, 64, y], fill=line)
        for _ in range(120):
            x, y = R.randrange(64), R.randrange(64); v = R.randint(-10, 10); c = im.getpixel((x, y)); im.putpixel((x, y), tuple(max(0, min(255, a + v)) for a in c))
        return im
    def flat(c, n=8):
        im = Image.new('RGB', (32, 32), c)
        for _ in range(60):
            x, y = R.randrange(32), R.randrange(32); v = R.randint(-n, n); im.putpixel((x, y), tuple(max(0, min(255, a + v)) for a in c))
        return im
    for name, P in PRESETS.items():
        quilt(P['top'], P['top_line'], 16 if name != 'reader' else 64).save(os.path.join(TEXOUT, f'{name}_top.png'))
        flat(P['legs']).save(os.path.join(TEXOUT, f'{name}_legs.png')); flat(P['shoe'], 4).save(os.path.join(TEXOUT, f'{name}_shoe.png'))
        Image.open(os.path.join(QD, 'Base Characters', 'Textures', P['skin'])).convert('RGB').resize((256, 256), Image.BOX).save(os.path.join(TEXOUT, f'{name}_skin.png'))
        src = Image.open(os.path.join(QD, 'Hairstyles', 'Textures', 'T_Hair_1_BaseColor.png')).convert('L').resize((64, 64), Image.BOX)
        tint = {'commuter': (20, 14, 10), 'reader': (40, 24, 14), 'sleeper': (70, 66, 62)}[name]
        Image.merge('RGB', [src.point(lambda v, t=t: int(t + v * 0.35)) for t in tint]).save(os.path.join(TEXOUT, f'{name}_hair.png'))
    print('painted passengers'); sys.exit(0)

# ---------------------------------------------------------------- the build (Blender)
import bpy, bmesh
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]
QD, NAME, OUT = argv[0], argv[1], argv[2]
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
P = PRESETS[NAME]; FPS, LOOP = 24, 12.0
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=os.path.join(QD, 'Base Characters', 'Godot - UE', f"Superhero_{P['base']}_FullBody.gltf"))
for o in list(sc.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
body = [o for o in sc.objects if o.type == 'MESH' and o.name.lower().startswith('superhero')][0]
before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(QD, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)', P['hair'] + '.gltf'))
hair_objs = [o for o in sc.objects if o not in before]; hair = [o for o in hair_objs if o.type == 'MESH'][0]
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
rest_mesh = bpy.data.meshes.new_from_object(hair.evaluated_get(dg)); rest_world = hair.matrix_world.copy()
for o in hair_objs: bpy.data.objects.remove(o)
hair = bpy.data.objects.new('Hair', rest_mesh); sc.collection.objects.link(hair); hair.matrix_world = rest_world
bpy.context.view_layer.update(); pbh = arm.pose.bones['Head']
hair.parent = arm; hair.parent_type = 'BONE'; hair.parent_bone = 'Head'
hair.matrix_parent_inverse = (arm.matrix_world @ pbh.matrix @ Matrix.Translation((0, pbh.length, 0))).inverted(); hair.matrix_world = rest_world

def mat(name, path):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path); t.interpolation = 'Closest'
    nt.links.new(t.outputs[0], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.8; return m
T = {k: os.path.join(TEXOUT, f'{NAME}_{k}.png') for k in ('skin', 'top', 'legs', 'shoe', 'hair')}
me = body.data; gi = {g.index: g.name for g in body.vertex_groups}
def region(v):
    w = sorted(((g.weight, gi[g.group]) for g in v.groups), reverse=True); top = w[0][1] if w else 'pelvis'
    hand_w = sum(g.weight for g in v.groups if any(k in gi[g.group] for k in ('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')))
    z = v.co.z
    if top in ('Head', 'neck_01') or hand_w > 0.35: return 'skin'
    if z < 0.105: return 'shoe'
    if top.startswith(('thigh', 'calf')) or top == 'pelvis' or (top == 'spine_01' and z < 0.99): return 'legs'
    return 'top'
REG = ['skin', 'top', 'legs', 'shoe']; me.materials.clear()
for r in REG: me.materials.append(mat(f'{NAME}_{r}', T[r]))
vreg = [region(v) for v in me.vertices]
for p in me.polygons:
    rs = [vreg[i] for i in p.vertices]; p.material_index = REG.index(max(set(rs), key=rs.count))
off = {'top': 0.018, 'legs': 0.006, 'shoe': 0.006, 'skin': 0.0}
for v in me.vertices: v.co += v.normal * off[vreg[v.index]]
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
jv = [bm.verts[i] for i, r in enumerate(vreg) if r == 'top']
for _ in range(4): bmesh.ops.smooth_vert(bm, verts=jv, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=False)
bm.to_mesh(me); bm.free()
while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
bpy.context.view_layer.objects.active = body; body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
for k in range(1, len(REG)): body.active_material_index = k; bpy.ops.object.material_slot_select()
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02, scale_to_bounds=False); bpy.ops.object.mode_set(mode='OBJECT')
uvd = me.uv_layers.active.data
for p in me.polygons:
    if p.material_index != 0:
        for li in p.loop_indices: uvd[li].uv = uvd[li].uv * 4.0
def planar(o, deg):
    bpy.context.view_layer.objects.active = o
    md = o.modifiers.new('planar', 'DECIMATE'); md.decimate_type = 'DISSOLVE'; md.angle_limit = math.radians(deg); md.delimit = {'MATERIAL', 'UV'}
    while o.modifiers[0] != md: bpy.ops.object.modifier_move_up(modifier='planar')
    bpy.ops.object.modifier_apply(modifier='planar')
planar(body, 9)
hair.data.materials.clear(); hair.data.materials.append(mat(f'{NAME}_hair', T['hair']))
for o in sc.objects:
    if o.type == 'MESH' and o.name.startswith('Eyebrows'): o.data.materials.clear(); o.data.materials.append(mat(f'{NAME}_brows', T['hair']))

# seated IK pose + idle
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); PB = arm.pose.bones
def empty(n, loc): e = bpy.data.objects.new(n, None); sc.collection.objects.link(e); e.location = loc; return e
def ik(b, t, p, pa): c = PB[b].constraints.new('IK'); c.target = t; c.pole_target = p; c.chain_count = 2; c.pole_angle = math.radians(pa); c.use_tail = True
DROP = 0.46; arm.location = (0, 0, -DROP)
(fl, fr) = P['feet']
FL, FR = empty('fl', (fl[0], fl[1], 0.06)), empty('fr', (fr[0], fr[1], 0.06))
KL, KR = empty('kl', (0.2, -1.5, 0.5)), empty('kr', (-0.2, -1.5, 0.5))
HLt, HRt = empty('hl', P['hands'][0]), empty('hr', P['hands'][1])
EL, ER = empty('el', (0.6, 0.2, 0.3)), empty('er', (-0.6, 0.2, 0.3))
ik('calf_l', FL, KL, -90); ik('calf_r', FR, KR, -90); ik('lowerarm_l', HLt, EL, -90); ik('lowerarm_r', HRt, ER, 90)
for b in PB: b.rotation_mode = 'XYZ'
PB['thigh_l'].rotation_euler = (math.radians(-85), 0, math.radians(4)); PB['thigh_r'].rotation_euler = (math.radians(-85), 0, math.radians(-4))
PB['spine_01'].rotation_euler = (math.radians(-P['lean'] * 0.5), 0, 0); PB['spine_02'].rotation_euler = (math.radians(-P['lean'] * 0.5), 0, 0)
for side in ('l', 'r'):
    for f_, a in (('index', (30, 35, 20)), ('middle', (35, 40, 22)), ('ring', (40, 45, 25)), ('pinky', (45, 50, 28))):
        PB[f'{f_}_01_{side}'].rotation_euler = (math.radians(a[0]), 0, 0); PB[f'{f_}_02_{side}'].rotation_euler = (math.radians(a[1]), 0, 0); PB[f'{f_}_03_{side}'].rotation_euler = (math.radians(a[2]), 0, 0)
for t, (rx, ry, rz) in P['head']:
    PB['Head'].rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz)); PB['Head'].keyframe_insert('rotation_euler', frame=1 + round(t * FPS))
for k in range(0, int(LOOP) + 1, 2):
    PB['spine_03'].rotation_euler = (math.radians(-1.5 if k % 4 else 0), 0, 0); PB['spine_03'].keyframe_insert('rotation_euler', frame=1 + k * FPS)
sc.frame_start, sc.frame_end = 1, int(LOOP * FPS); bpy.ops.object.mode_set(mode='OBJECT')
# props held in the lap: a phone (glowing screen) or a paperback
if P['prop']:
    pr = bpy.data.objects.new(P['prop'], bpy.data.meshes.new(P['prop'])); sc.collection.objects.link(pr)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(pr.data); bm.free()
    pr.scale = (0.075, 0.15, 0.009) if P['prop'] == 'phone' else (0.13, 0.19, 0.025)
    pm = bpy.data.materials.new(NAME + '_prop'); pm.use_nodes = True
    pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.03, 0.03, 0.035, 1) if P['prop'] == 'phone' else (0.6, 0.15, 0.1, 1)
    if P['prop'] == 'phone': pm.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (0.5, 0.65, 0.9, 1); pm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.6
    pr.data.materials.append(pm)
    mid = (Vector(P['hands'][0]) + Vector(P['hands'][1])) / 2
    pr.location = mid + Vector((0, -0.07, 0.03)); pr.rotation_euler = (math.radians(-35), 0, 0)
    bone = arm.data.bones['hand_r']; pr.parent = arm; pr.parent_type = 'BONE'; pr.parent_bone = 'hand_r'
    sc.frame_set(1); bpy.context.view_layer.update()
    pr.matrix_parent_inverse = (arm.matrix_world @ arm.pose.bones['hand_r'].matrix @ Matrix.Translation((0, bone.length, 0))).inverted()

if opt('--preview'):
    sc.frame_set(1 + round(float(opt('--t', '2')) * FPS))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0.9, -1.9, 0.95); cam.data.lens = 40; cam.rotation_euler = (Vector((0, 0, 0.75)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.render.resolution_x = 480; sc.render.resolution_y = 480; sc.render.filepath = opt('--preview')
    bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type in ('MESH', 'ARMATURE'): o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_force_sampling=True,
                          export_bake_animation=True, export_frame_range=True, export_anim_single_armature=True)
print('EXPORTED', OUT)
