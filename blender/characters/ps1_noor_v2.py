"""Noor v2: the PS1 study's passenger, built on a CC0 rigged base body (Quaternius Universal Base Characters,
public domain), dressed and styled as our own original character, reduced to a PS1 budget, posed seated with
IK + finger poses, given a 12 s idle loop, exported as an animated GLB for engine/studies/ps1-subway-v2.

    blender -b --factory-startup --python blender/characters/ps1_noor.py -- <quaternius_dir> <out.glb> [--preview out.png] [--t 3.0]

Outfit (ours): a red puffer jacket with a black yoke and black cuffs, open over a black top; dark denim; white
sneakers; a brown bob cut from the base kit's long hair. Story loop (12 s): she holds the cigarette by her face,
takes a drag (2-3.7 s), exhales, looks to the dark window as a tunnel lamp passes (6-7.6 s), lowers the hand to
her knee and taps the ash (8-9.6 s), brings it back up.
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
QD, OUT = argv[0], argv[1]
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
PREVIEW = opt('--preview'); TPREV = float(opt('--t', '3.0'))
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TEXOUT = os.path.join(ROOT, 'engine', 'studies', 'ps1-subway-v2', 'assets')
os.makedirs(TEXOUT, exist_ok=True)
FPS, LOOP = 24, 12.0

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=os.path.join(QD, 'Base Characters', 'Godot - UE', 'Superhero_Female_FullBody.gltf'))
for o in list(sc.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
body = bpy.data.objects['Superhero_Female']
before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(QD, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)', 'Hair_Long.gltf'))
hair_objs = [o for o in sc.objects if o not in before]
hair = [o for o in hair_objs if o.type == 'MESH'][0]
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
rest_mesh = bpy.data.meshes.new_from_object(hair.evaluated_get(dg))      # the hair as it sits on the head (its own rig at rest)
rest_world = hair.matrix_world.copy()
for o in hair_objs: bpy.data.objects.remove(o)
hair = bpy.data.objects.new('Hair_Bob', rest_mesh); sc.collection.objects.link(hair); hair.matrix_world = rest_world
bpy.context.view_layer.update()
pb_head = arm.pose.bones['Head']
hair.parent = arm; hair.parent_type = 'BONE'; hair.parent_bone = 'Head'
hair.matrix_parent_inverse = (arm.matrix_world @ Matrix.Translation(pb_head.tail - pb_head.head) @ pb_head.matrix).inverted() if False else (arm.matrix_world @ pb_head.matrix @ Matrix.Translation((0, pb_head.length, 0))).inverted()
hair.matrix_world = rest_world
for vg in list(hair.vertex_groups): hair.vertex_groups.remove(vg)
for md in list(hair.modifiers): hair.modifiers.remove(md)

# ---------------------------------------------------------------- textures (painted small, nearest-filtered in the engine)
# textures: painted by blender/characters/ps1_noor_textures.py (system python + PIL)
T = {k: os.path.join(TEXOUT, f'noor_{v}.png') for k, v in (('jacket_red', 'jacket_red'), ('jacket_black', 'jacket_black'), ('denim', 'denim'), ('shoe', 'shoe'), ('top', 'top'), ('skin', 'skin'), ('hair', 'hair'))}
def mat(name, path):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path); t.interpolation = 'Closest'
    nt.links.new(t.outputs[0], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.8
    return m

# ---------------------------------------------------------------- dress the body: regions from bone weights
me = body.data
gi = {g.index: g.name for g in body.vertex_groups}
def region(v, co):
    w = sorted(((g.weight, gi[g.group]) for g in v.groups), reverse=True)
    top = w[0][1] if w else 'pelvis'
    hand_w = sum(g.weight for g in v.groups if any(k in gi[g.group] for k in ('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')))
    z, x, y = co.z, co.x, co.y
    if top in ('Head', 'neck_01') or hand_w > 0.35: return 'skin'
    if z < 0.105: return 'shoe'
    if top.startswith(('thigh', 'calf')) or top == 'pelvis' or (top == 'spine_01' and z < 0.99): return 'denim'
    # the jacket: black yoke over the shoulders and black cuffs; open at the front over a black top
    if top.startswith('lowerarm') and abs(x) > 0.57: return 'jacket_black'
    return 'jacket_red'
REG = ['skin', 'jacket_red', 'jacket_black', 'top', 'denim', 'shoe']
me.materials.clear()
for r in REG: me.materials.append(mat('noor_' + r, T[r]))
vreg = [region(v, v.co) for v in me.vertices]
for p in me.polygons:
    rs = [vreg[i] for i in p.vertices]; p.material_index = REG.index(max(set(rs), key=rs.count))
# clothes have volume: the puffer stands off the body, jeans a little, sneakers are chunky
off = {'jacket_red': 0.022, 'jacket_black': 0.022, 'top': 0.008, 'denim': 0.006, 'shoe': 0.006, 'skin': 0.0}
for v in me.vertices:
    v.co += v.normal * off[vreg[v.index]]
# a puffer hangs, it doesn't hug: smooth the jacket shell so it fills the hollows (a boxier, cleaner silhouette)
bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table()
jv = [bm.verts[i] for i, r in enumerate(vreg) if r in ('jacket_red', 'top')]
bmesh.ops.smooth_vert(bm, verts=jv, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
for _ in range(5): bmesh.ops.smooth_vert(bm, verts=jv, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=False)
bm.to_mesh(me); bm.free()

# keep one UV map; clothes get their own projection (tileable patterns), skin keeps the base layout
while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
bpy.context.view_layer.objects.active = body; body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
for k in range(1, len(REG)):
    body.active_material_index = k; bpy.ops.object.material_slot_select()
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
uv = me.uv_layers.active.data
for p in me.polygons:   # tile the clothes patterns (smart project packs islands into 0..1; scale up so quilting reads)
    if p.material_index != 0:
        for li in p.loop_indices: uv[li].uv = uv[li].uv * 4.0

# PS1 budget: decimate (vertex groups survive), hair cut into a bob and recoloured
def decimate(o, ratio):
    bpy.context.view_layer.objects.active = o
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio
    while o.modifiers[0] != md: bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
# body kept at full resolution (12.8k tris): clean clothing borders; the PS1 look comes from the renderer
hb_head_z = (arm.matrix_world @ arm.data.bones['Head'].head_local).z
bm = bmesh.new(); bm.from_mesh(hair.data)
mw = hair.matrix_world
cut = [v for v in bm.verts if (mw @ v.co).z < hb_head_z - 0.085]
bmesh.ops.delete(bm, geom=cut, context='VERTS'); bm.to_mesh(hair.data); bm.free()
hair.data.materials.clear(); hair.data.materials.append(mat('noor_hair', T['hair']))
decimate(hair, 0.75)
for o in sc.objects:
    if o.type == 'MESH' and o.name.startswith('Eyebrows'):
        o.data.materials.clear(); o.data.materials.append(mat('noor_brows', T['hair']))

# ---------------------------------------------------------------- the pose rig: IK for the arms and legs, FK for spine, head, fingers
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
PB = arm.pose.bones
def empty(name, loc):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e); e.location = loc; return e
def ik(bone, target, pole, chain=2, pole_angle=0):
    c = PB[bone].constraints.new('IK'); c.target = target; c.pole_target = pole; c.chain_count = chain; c.pole_angle = math.radians(pole_angle); c.use_tail = True
    return c
# seated: the pelvis drops to the seat and leans back a little
SEAT_DROP = 0.46
PB['pelvis'].location = (0, 0, 0)
arm.location = (0, 0, -SEAT_DROP)
FOOT_L, FOOT_R = empty('foot_l_t', (0.16, -0.52, 0.06 - 0.0)), empty('foot_r_t', (-0.13, -0.47, 0.06))
KNEE_L, KNEE_R = empty('knee_l_p', (0.2, -1.5, 0.5)), empty('knee_r_p', (-0.2, -1.5, 0.5))
# the thighs come forward: with the pelvis down, the IK has to fold the legs; we pre-bend the thighs so it chooses the seat
HAND_L, HAND_R = empty('hand_l_t', (0.0, 0.0, 0.0)), empty('hand_r_t', (-0.16, -0.4, 0.52))
ELB_L, ELB_R = empty('elbow_l_p', (0.45, -0.15, 0.25)), empty('elbow_r_p', (-0.7, 0.3, 0.3))
ik('calf_l', FOOT_L, KNEE_L, pole_angle=-90); ik('calf_r', FOOT_R, KNEE_R, pole_angle=-90)
ik('lowerarm_l', HAND_L, ELB_L, pole_angle=-90); ik('lowerarm_r', HAND_R, ELB_R, pole_angle=180)
for b in PB: b.rotation_mode = 'XYZ'
PB['thigh_l'].rotation_euler = (math.radians(-85), 0, math.radians(4)); PB['thigh_r'].rotation_euler = (math.radians(-85), 0, math.radians(-4))
PB['spine_01'].rotation_euler = (math.radians(8), 0, 0); PB['spine_02'].rotation_euler = (math.radians(4), 0, 0)

# fingers: the left hand holds the cigarette between index and middle; the right rests half-curled on the knee
def curl(side, finger, a1, a2, a3, spread=0):
    PB[f'{finger}_01_{side}'].rotation_euler = (math.radians(a1), 0, math.radians(spread))
    PB[f'{finger}_02_{side}'].rotation_euler = (math.radians(a2), 0, 0); PB[f'{finger}_03_{side}'].rotation_euler = (math.radians(a3), 0, 0)
for f_, a in (('index', (8, 10, 6)), ('middle', (10, 12, 8)), ('ring', (55, 70, 40)), ('pinky', (60, 75, 45))): curl('l', f_, *a)
PB['index_01_l'].rotation_euler.z = math.radians(-6); PB['middle_01_l'].rotation_euler.z = math.radians(5)
PB['thumb_02_l'].rotation_euler = (math.radians(20), 0, math.radians(15))
for f_, a in (('index', (25, 30, 20)), ('middle', (30, 35, 22)), ('ring', (35, 40, 25)), ('pinky', (40, 45, 28))): curl('r', f_, *a)

# ---------------------------------------------------------------- the 12 s story loop (keyed IK targets + head + breathing)
def key(obj, path, frame): obj.keyframe_insert(path, frame=frame)
MOUTH = Vector((0.03, -0.11, 1.5 - SEAT_DROP + 0.0))
REST = Vector((0.15, -0.26, 1.3 - SEAT_DROP))
DRAG = Vector((0.05, -0.19, 1.5 - SEAT_DROP))
KNEE = Vector((0.2, -0.42, 0.62 - SEAT_DROP + 0.1))
HL = [(0, REST), (1.8, REST), (2.6, DRAG), (3.7, DRAG), (4.5, REST), (7.2, REST), (8.0, KNEE), (8.55, KNEE), (8.65, KNEE + Vector((0, 0, -0.025))), (8.8, KNEE), (9.6, KNEE), (10.6, REST), (12.0, REST)]
for t, p in HL: HAND_L.location = p; key(HAND_L, 'location', 1 + round(t * FPS))
HEAD = [(0, (-6, -10, 0)), (2.0, (-6, -10, 0)), (2.6, (-12, -5, 0)), (3.7, (-12, -5, 0)), (4.6, (-8, -8, 0)), (6.0, (-8, 22, 0)), (7.6, (-8, 22, 0)), (8.4, (2, -12, 0)), (10.0, (0, -10, 0)), (11.2, (-6, -10, 0)), (12.0, (-6, -10, 0))]
for t, (rx, ry, rz) in HEAD:
    PB['Head'].rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz)); key(PB['Head'], 'rotation_euler', 1 + round(t * FPS))
for k in range(0, int(LOOP) + 1, 2):   # breathing: the chest rises every 4 s
    PB['spine_03'].rotation_euler = (math.radians(-2 if k % 4 else 0), 0, 0); key(PB['spine_03'], 'rotation_euler', 1 + k * FPS)
sc.frame_start, sc.frame_end = 1, int(LOOP * FPS)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- the cigarette (parented to the left hand) with an ember
cig = bpy.data.objects.new('cigarette', bpy.data.meshes.new('cig')); sc.collection.objects.link(cig)
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0045, radius2=0.0045, depth=0.08); bm.to_mesh(cig.data); bm.free()
cm = bpy.data.materials.new('noor_cig'); cm.use_nodes = True; cm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.92, 0.9, 0.85, 1); cig.data.materials.append(cm)
cig.parent = arm; cig.parent_type = 'BONE'; cig.parent_bone = 'index_02_l'
cig.matrix_parent_inverse = Matrix.Identity(4); cig.location = (0.012, 0.0, -0.01); cig.rotation_euler = (0, math.radians(90), 0)
ember = bpy.data.objects.new('ember', None); sc.collection.objects.link(ember); ember.parent = cig; ember.location = (0, 0, 0.04)

if PREVIEW:
    sc.frame_set(1 + round(TPREV * FPS))
    HEADCAM = '--headcam' in argv
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    hpos = arm.matrix_world @ arm.pose.bones['Head'].head
    cam.location = (0.9, -1.9, 0.95) if not HEADCAM else hpos + Vector((0.25, -0.8, 0.05)); cam.data.lens = 40 if not HEADCAM else 85
    cam.rotation_euler = ((Vector((0.0, 0.0, 0.75)) if not HEADCAM else hpos + Vector((0, 0, 0.05))) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
    seat = bpy.data.objects.new('seat', bpy.data.meshes.new('seat')); sc.collection.objects.link(seat)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(seat.data); bm.free(); seat.scale = (1.4, 0.48, 0.46); seat.location = (0, 0.12, 0.23)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.render.resolution_x = 640; sc.render.resolution_y = 640; sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- export (baked constraints -> plain bone animation)
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type in ('MESH', 'ARMATURE') and o.name not in ('seat',): o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_force_sampling=True,
                          export_bake_animation=True, export_frame_range=True, export_anim_single_armature=True, export_image_format='AUTO')
print('EXPORTED', OUT)
