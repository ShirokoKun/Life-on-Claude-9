"""Fresh Blender only: --background --factory-startup --python create_blockout.py -- --output room.blend [--render preview.png]"""
import argparse
import sys
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
parser.add_argument('--render', help='Optional 640x360 preview PNG path')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if not bpy.app.background or '--factory-startup' not in sys.argv or bpy.data.filepath:
    raise SystemExit('Run in a fresh background process with --factory-startup.')
output = Path(args.output).expanduser().resolve()
preview = Path(args.render).expanduser().resolve() if args.render else None
if output.suffix.lower() != '.blend':
    raise SystemExit('Output must end in .blend')
if output.exists() or (preview and preview.exists()):
    raise SystemExit('Refusing to overwrite an existing file.')
if preview and preview.suffix.lower() != '.png':
    raise SystemExit('Preview must end in .png')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
    return mat

wall = material('Warm plaster', (.65, .62, .55))
wood = material('Wood placeholder', (.24, .13, .07))
cloth = material('Fabric placeholder', (.18, .24, .28))
plastic = material('Beige plastic', (.55, .52, .42))

def box(name, location, dimensions, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj

box('Floor', (0, 0, -.1), (4.8, 4.8, .2), wood)
box('Back wall lower', (0, 2.4, .55), (4.8, .15, 1.1), wall)
box('Back wall header', (0, 2.4, 2.65), (4.8, .15, .3), wall)
for x in [-2.25, 0, 2.25]:
    box('Window wall pier', (x, 2.4, 1.8), (.3, .15, 1.4), wall)
box('Left wall', (-2.4, 0, 1.4), (.15, 4.8, 2.8), wall)
box('Right wall', (2.4, 0, 1.4), (.15, 4.8, 2.8), wall)
box('Bed base', (-1.5, .15, .25), (1.3, 2.1, .5), wood)
box('Mattress', (-1.5, .15, .58), (1.3, 2.1, .16), cloth)
box('Pillow', (-1.5, .9, .72), (.8, .4, .14), plastic)
box('Desk', (0, 1.8, .76), (1.8, .7, .1), wood)
for x in [-.75, .75]:
    box('Desk pedestal', (x, 1.8, .35), (.25, .6, .7), wood)
box('CRT computer', (-.1, 1.8, 1.08), (.5, .4, .5), plastic)
box('Tower', (.55, 1.8, 1.05), (.24, .4, .48), plastic)
box('Chair seat', (0, .8, .48), (.55, .55, .12), cloth)
box('Chair back', (0, .55, .8), (.55, .12, .6), cloth)
box('Chair stem', (0, .8, .23), (.08, .08, .46), plastic)
box('Rug', (0, .5, .012), (1.9, 1.7, .024), cloth)
box('TV cabinet', (1.75, 1.4, .35), (1, .6, .7), wood)
box('CRT television', (1.75, 1.4, 1.02), (.8, .55, .6), cloth)
bpy.ops.object.camera_add(location=(0, -4.1, 1.65))
camera = bpy.context.object
camera.name = 'Doorway Camera'
camera.rotation_euler = (Vector((0, .9, 1.1)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.lens = 25
scene = bpy.context.scene
scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(0, 2.1, 2.25))
light = bpy.context.object
light.name = 'Window daylight'
light.data.energy = 450
light.data.shape = 'RECTANGLE'
light.data.size = 3
light.data.size_y = 1
light.rotation_euler = (Vector((0, 0, .4)) - light.location).to_track_quat('-Z', 'Y').to_euler()
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65, .72, .85, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .25
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_end = 1
output.parent.mkdir(parents=True, exist_ok=True)
if preview:
    preview.parent.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(preview)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
if preview:
    bpy.ops.render.render(write_still=True)
print('Blockout saved:', output)
