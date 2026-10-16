"""Chapter 1 keyframes (kf1) only: bake the dawn lightmaps on the SHIPPED room (engine/scenes/s03/room/room.glb).

    blender -b --factory-startup -P blender/scenes/kf1_dawn_bake.py -- engine/scenes/kf1/lighting/dawn [--half] [--samples 64]

Why not set_room03.py --bake: its lightmap UVs come from smart_project at bake time, and Blender 5.2 packs them
differently from the version that baked room.glb (a test bake matched the shipped maps' layout on only 71-86% of
texels). This script imports room.glb itself and bakes into its own TEXCOORD_1 ("UVMap.001"), so the maps line up
with what the engine loads, whatever the Blender version. Nothing of s03 is written: the output goes to the kf1 folder.

The light is set_room03's 'dawn_kf1' preset (light_rig): the dawn sun raking in from the south-west onto Ivan at the
desk. The sun is a LIVE light (lightmap = everything - the live lights' direct): the engine draws its direct light
with a shadow map, so Ivan, the chair, the guitar and the laptop shadow it; the bake keeps its bounce.
Albedo: the set's flat material colours (set_room03.mats(), as the original bake's FLAT_ALBEDO), the scans' images.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import set_room03 as R  # noqa: E402
import lightmap as LMB  # noqa: E402
import bake as BK  # noqa: E402

ROOT = HERE.parents[1]
GROUPS = {"ARCH": 4096, "DESK": 2048, "ROOM": 4096, "PROPS": 2048, "WALLN": 1024, "CEIL": 1024}
OUTSIDE = ("Sky_Card", "Hill", "Ground", "Neighbourhood", "Facade", "Street_", "Valley_", "House_Windows", "Aviation_")


def flat_colours():
    """The set's material colours (what the original bake used for albedo), then drop those materials again."""
    before = set(bpy.data.materials)
    m = R.mats()
    cols = {mat.name: tuple(mat.diffuse_color[:3]) for mat in m.values()}
    for mat in set(bpy.data.materials) - before:
        bpy.data.materials.remove(mat)
    return cols


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out = (ROOT / args[0]).resolve() if not Path(args[0]).is_absolute() else Path(args[0])
    half = "--half" in args
    samples = int(args[args.index("--samples") + 1]) if "--samples" in args else 64
    preset = args[args.index("--preset") + 1] if "--preset" in args else "dawn_kf1"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    cols = flat_colours()
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "engine/scenes/s03/room/room.glb"))
    # albedo: a flat (unlinked) white base colour is a material the engine textures; give it the set's colour
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for bs in [n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]:
            sock = bs.inputs["Base Color"]
            base = mat.name.rsplit(".", 1)[0]
            if not sock.is_linked and base in cols and min(sock.default_value[:3]) > 0.99:
                sock.default_value = (*cols[base], 1)
    data = json.loads((ROOT / "engine/scenes/s03/room/lights.json").read_text())
    by = {l["name"]: l for l in data["lights"]}
    scene["lamp"] = list(Vector(by["Desk_Lamp"]["location"]) + Vector((0, 0, 0.06)))
    scene["story_lamp"] = by["Story_Lamp"]["location"] if "Story_Lamp" in by else scene["lamp"]
    for o in bpy.data.objects:                       # the sky card and the far city must not shade the sun
        if o.name.startswith(OUTSIDE):
            o.visible_shadow = False
    if "--bed" in args:                              # the kf1 bed (bed.glb) in place of the set's: bake only its own map
        import bmesh
        room = bpy.data.objects["Baked_ROOM"]
        old = {i for i, sl in enumerate(room.material_slots) if sl.material and sl.material.name.rsplit(".", 1)[0] in ("Duvet Navy", "Sheet Cotton", "Pillow Linen")}
        bm = bmesh.new(); bm.from_mesh(room.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in old], context="FACES")
        bm.to_mesh(room.data); bm.free()
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / args[args.index("--bed") + 1]))
        new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        bed = new[0]
        bed.name = "Baked_BED"
        for mat in bed.data.materials:                # glTF keeps the base colour; give the flat albedo to the bake
            bs = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bs:
                mat.diffuse_color = tuple(bs.inputs["Base Color"].default_value)
        GROUPS["BED"] = 1024
    R.light_rig(scene, preset)
    LMB.LIVE_LIGHTS = ("Key_Laptop", "Sun") if R.PRESETS[preset].get("live_sun") else ("Key_Laptop",)
    LMB.unblock_live_lights()
    BK.FLAT_ALBEDO = True

    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "METAL"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                break
        except TypeError:
            continue
    for d in prefs.devices:
        d.use = d.type != "CPU"
    print("baking on", prefs.compute_device_type, flush=True)
    scene.render.bake.margin = 8
    (out / "lightmaps").mkdir(parents=True, exist_ok=True)
    only = args[args.index("--only") + 1].split(",") if "--only" in args else list(GROUPS)
    for g in only:
        ob = bpy.data.objects[f"Baked_{g}"]
        size = GROUPS[g] // (2 if half else 1)
        ob.data.uv_layers.active = ob.data.uv_layers[1]               # the engine's TEXCOORD_1 ("UVMap.001")
        ob.data.uv_layers["UVMap"].active_render = True
        full = bpy.data.images.new(f"lm_{g}_full", size, size, float_buffer=True)
        live = bpy.data.images.new(f"lm_{g}_live", size, size, float_buffer=True)
        originals = [s.material for s in ob.material_slots]
        BK._targets(ob, full)
        print("baking", g, size, flush=True)
        scene.cycles.samples = samples
        LMB._bake_into(ob, full, {"DIRECT", "INDIRECT"})
        a = LMB._denoised(full, out / "lightmaps" / f"lm_{g}_full.exr")
        st = LMB._live_only(True)
        scene.cycles.samples = max(24, samples // 2)
        LMB._bake_into(ob, live, {"DIRECT"})
        LMB._restore(st)
        b = LMB._denoised(live, out / "lightmaps" / f"lm_{g}_live.exr")
        lm = np.clip(a - b, 0.0, None)
        lm[..., 3] = 1.0
        LMB._save_exr(lm, out / "lightmaps" / f"lm_{g}.exr")
        print("lightmap", g, "mean", float(lm[..., :3].mean()), flush=True)
        for slot, m in zip(ob.material_slots, originals):
            copy = slot.material
            slot.material = m
            if copy is not m:
                bpy.data.materials.remove(copy)
        for im in (full, live):
            bpy.data.images.remove(im)
    sun = bpy.data.objects.get("Sun")
    if "--only" in args and (out / "lights.json").exists():   # a partial bake (the bed) keeps the set's record
        print("BAKED", preset, out, flush=True)
        return
    rec = {"preset": preset, "exposure": scene.view_settings.exposure, "source": "engine/scenes/s03/room/room.glb (TEXCOORD_1)",
           "live": list(LMB.LIVE_LIGHTS),
           "sun": {"energy": sun.data.energy, "color": list(sun.data.color),
                   "travel": list(sun.matrix_world.to_3x3() @ Vector((0, 0, -1)))} if sun else None}
    (out / "lights.json").write_text(json.dumps(rec, indent=1))
    print("BAKED", preset, out, flush=True)


main()
