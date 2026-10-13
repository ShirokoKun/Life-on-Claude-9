"""Export the 3 AM room for the three.js engine (engine/): geometry + material names + lightmaps.

    python -I blender/scenes/export_engine.py engine/assets [--small] [--samples 64]
    python -I blender/scenes/export_engine.py engine/assets/lighting/day --preset day --lm-only

--preset bakes another time of day onto the same geometry (the clock stays at 3:04 so the meshes and
lightmap UVs match room.glb); --lm-only writes just lightmaps/ and lights.json; --half bakes at half
resolution (the UV islands do not depend on the size).

Writes  <out>/room.glb            meshes, material slots by name, TEXCOORD_0 = metric tiling UV,
                                   TEXCOORD_1 = lightmap UV (baked groups)
        <out>/lightmaps/lm_*.exr  linear HDR irradiance (E/pi), live lights' direct light removed
        <out>/lights.json         the live lights and practical positions, in Blender coordinates
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib"), str(HERE.parent / "characters")]

import bpy  # noqa: E402

import export_intro as X  # noqa: E402
import lightmap  # noqa: E402
import set_intro  # noqa: E402


def light_record(o):
    d = o.data
    rec = {"name": o.name, "type": d.type, "energy_w": d.energy, "color": list(d.color),
           "location": list(o.location), "forward": list(o.matrix_world.to_3x3() @ __import__("mathutils").Vector((0, 0, -1)))}
    if d.type == "SPOT":
        rec.update(spot_deg=math.degrees(d.spot_size), blend=d.spot_blend, radius=d.shadow_soft_size)
    if d.type == "AREA":
        rec.update(size=[d.size, d.size_y])
    if d.type == "POINT":
        rec.update(radius=d.shadow_soft_size)
    return rec


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]   # bpy module, or blender -b -P ... --
    out = Path(args[0]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    small = "--small" in args
    samples = int(args[args.index("--samples") + 1]) if "--samples" in args else 64
    preset = args[args.index("--preset") + 1] if "--preset" in args else "3am"
    lm_only = "--lm-only" in args
    scene, _ = set_intro.build(preset, look=False, ivan_blend=None, clock=(3, 4))
    for o in list(bpy.data.objects):
        if o.name in ("Room_Haze_Volume", "Dust_Motes"):
            bpy.data.objects.remove(o, do_unlink=True)
    X.curves_to_meshes()
    lights = [light_record(o) for o in bpy.data.objects if o.type == "LIGHT"]
    marks = {n: list(bpy.data.objects[n].matrix_world.translation) for n in
             ("Lamp_Shade", "Lamp_Bulb", "Laptop_Screen", "Monitor_Screen", "Water_Glass", "Wall_Clock") if n in bpy.data.objects}
    (out / "lights.json").write_text(json.dumps({"lights": lights, "marks": marks,
                                                 "exposure": scene.view_settings.exposure,
                                                 "live": list(lightmap.LIVE_LIGHTS)}, indent=1))
    lightmap.bake_lightmaps(out / "lightmaps",
                            sizes={"ARCH": 256, "DESK": 256, "ROOM": 256} if small else
                            {"ARCH": 2048, "DESK": 2048, "ROOM": 1024} if "--half" in args else None,
                            samples=4 if small else samples, live_samples=2 if small else 24,
                            reuse="--resume" in args)
    if lm_only:
        print("BAKED", preset, out / "lightmaps", flush=True)
        sys.exit(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "room_lit.blend"))
    X.strip_for_web()
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "room_engine.blend"))
    bpy.ops.export_scene.gltf(filepath=str(out / "room.glb"), export_format="GLB", export_apply=True,
                              export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False,
                              export_yup=True, export_extras=True, export_image_format="AUTO", export_animations=False)
    print("EXPORTED", out / "room.glb", (out / "room.glb").stat().st_size / 1e6, "MB", flush=True)
