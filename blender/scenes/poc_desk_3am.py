"""Pipeline proof: a blocked-out desk corner at 3 AM, built entirely from code.

Run headless (no Blender UI needed):
    python blender/scenes/poc_desk_3am.py OUT_DIR [--blend]

Writes OUT_DIR/index.html + models/*.glb via the vendored three-blender exporter.
Grey-box only: shapes and light logic, not final materials.
"""
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "vendor"))

import three_blender  # noqa: E402
from three_blender.exporter import SceneExporter  # noqa: E402


def material(name, color, roughness=0.6, metallic=0.0, emission=None, strength=0.0,
             transmission=0.0, ior=1.45):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Transmission Weight"].default_value = transmission
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def box(name, size, loc, mat, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, loc, mat, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    three_blender.register()
    scene = bpy.context.scene

    plaster = material("Plaster", (0.55, 0.53, 0.50), 0.85)
    oak = material("Desk Oak", (0.30, 0.18, 0.10), 0.45)
    floor = material("Floor", (0.22, 0.16, 0.11), 0.4)
    alu = material("Laptop Alu", (0.6, 0.6, 0.62), 0.3, metallic=1.0)
    screen = material("Screen", (0.02, 0.02, 0.03), 0.2,
                      emission=(0.55, 0.75, 1.0), strength=6.0)
    glass = material("Glass", (0.95, 0.97, 1.0), 0.02, transmission=1.0, ior=1.5)
    ceramic = material("Mug", (0.85, 0.83, 0.78), 0.25)
    fabric = material("Chair", (0.05, 0.05, 0.06), 0.9)
    night = material("City Night", (0.0, 0.0, 0.0), 1.0,
                     emission=(0.12, 0.16, 0.30), strength=0.6)

    # Room corner: 2.7 m ceiling, window in the back wall.
    box("Floor", (4, 4, 0.02), (0, 0, -0.01), floor, bevel=0)
    box("Wall Back L", (1.2, 0.12, 2.7), (-1.4, 1.5, 1.35), plaster, bevel=0)
    box("Wall Back R", (1.2, 0.12, 2.7), (1.4, 1.5, 1.35), plaster, bevel=0)
    box("Wall Back Sill", (1.6, 0.12, 0.9), (0, 1.5, 0.45), plaster, bevel=0)
    box("Wall Back Head", (1.6, 0.12, 0.5), (0, 1.5, 2.45), plaster, bevel=0)
    box("Wall Left", (0.12, 4, 2.7), (-2.0, -0.5, 1.35), plaster, bevel=0)
    box("City Backdrop", (6, 0.05, 4), (0, 4.5, 1.5), night, bevel=0)

    # Desk 140x70x75 cm.
    box("Desk Top", (1.4, 0.7, 0.03), (0, 0.9, 0.745), oak)
    for x in (-0.66, 0.66):
        box(f"Desk Leg {x}", (0.04, 0.64, 0.73), (x, 0.9, 0.365), oak)

    # Laptop: 31x22 cm base, screen tilted back ~110 degrees.
    box("Laptop Base", (0.31, 0.22, 0.015), (0, 0.85, 0.768), alu, bevel=0.003)
    lid = box("Laptop Lid", (0.31, 0.008, 0.21), (0, 0.965, 0.87), alu, bevel=0.003)
    lid.rotation_euler.x = math.radians(-18)
    panel = box("Laptop Screen", (0.29, 0.002, 0.185), (0, 0.958, 0.872), screen, bevel=0)
    panel.rotation_euler.x = math.radians(-18)

    # The untouched glass of water and the coffee mugs.
    cylinder("Water Glass", 0.035, 0.12, (0.32, 0.75, 0.82), glass)
    cylinder("Mug A", 0.042, 0.095, (-0.38, 0.8, 0.808), ceramic)
    cylinder("Mug B", 0.042, 0.095, (-0.5, 1.0, 0.808), ceramic)

    # Chair stand-in.
    box("Chair Seat", (0.5, 0.48, 0.08), (0, 0.15, 0.48), fabric, bevel=0.02)
    back = box("Chair Back", (0.48, 0.06, 0.6), (0, -0.12, 0.85), fabric, bevel=0.02)
    back.rotation_euler.x = math.radians(-8)

    # Key light: the laptop screen itself, as an area light facing the user.
    key = bpy.data.lights.new("Screen Light", "AREA")
    key.shape = "RECTANGLE"
    key.size, key.size_y = 0.29, 0.185
    key.energy = 18.0
    key.color = (0.62, 0.78, 1.0)
    key_obj = bpy.data.objects.new("Screen Light", key)
    key_obj.location = (0, 0.95, 0.875)
    key_obj.rotation_euler = (math.radians(90 - 18 + 180), 0, 0)
    scene.collection.objects.link(key_obj)

    # Cold city spill through the window.
    spill = bpy.data.lights.new("City Spill", "SPOT")
    spill.energy = 60.0
    spill.color = (0.45, 0.55, 0.85)
    spill.spot_size = math.radians(70)
    spill.spot_blend = 0.8
    spill_obj = bpy.data.objects.new("City Spill", spill)
    spill_obj.location = (0.4, 3.0, 2.2)
    spill_obj.rotation_euler = (math.radians(-60), 0, math.radians(180))
    scene.collection.objects.link(spill_obj)

    # Camera: over-the-shoulder, 35 mm, shallow focus on the screen.
    cam = bpy.data.cameras.new("Cam OTS")
    cam.lens = 35
    cam.dof.use_dof = True
    cam.dof.focus_distance = 1.2
    cam.dof.aperture_fstop = 2.0
    cam_obj = bpy.data.objects.new("Cam OTS", cam)
    cam_obj.location = (0.55, -0.45, 1.35)
    cam_obj.rotation_euler = (math.radians(68), 0, math.radians(22))
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    world = bpy.data.worlds.new("Night")
    world.color = (0.004, 0.005, 0.01)
    scene.world = world
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.view_settings.exposure = 0.8
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080

    tree = bpy.data.node_groups.new("Comp", "CompositorNodeTree")
    scene.compositing_node_group = tree
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Threshold"].default_value = 0.8
    scene.threejs_use_postprocessing = "--no-post" not in sys.argv
    return scene


if __name__ == "__main__":
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    scene = build()
    if "--blend" in sys.argv:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "poc_desk_3am.blend"))
    print("exported", SceneExporter(str(out / "index.html"), scene=scene).run())
