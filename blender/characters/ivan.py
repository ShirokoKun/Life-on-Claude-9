"""Ivan, built headless on MPFB2 (MakeHuman for Blender, CC0 output).

    BLENDER_USER_RESOURCES=<dir with mpfb installed> python -I blender/characters/ivan.py OUT_DIR [--turnaround] [--blend]

Design source: reference/ours/03-character-sheet-ivan.jpg (thin, ~30, long oval face, round dark
glasses, short side-parted light-brown hair, white crew-neck sweater over a white collared shirt,
dark pleated trousers, brown leather shoes). Render language: game-grade realistic like the
OpenKnight reference (PBR skin with SSS, strand hair, subtle asymmetry).
"""
import importlib
import math
import sys
from pathlib import Path

import bpy  # first: it puts addon_utils & mathutils on the path
import addon_utils
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "lib")]

import geo  # noqa: E402
import materials as M  # noqa: E402

MH_DATA = Path("/tmp/claude-0/-home-user-Ivan-3dScenes/da3f3960-1c51-545b-b8d1-75f12f48771a/scratchpad/ext/mh/makehuman/data")

MACROS = {"gender": 1.0, "age": 0.54, "muscle": 0.42, "weight": 0.30, "height": 0.50, "proportions": 0.55,
          "cupsize": 0.5, "firmness": 0.5, "race": {"caucasian": 1.0, "asian": 0.0, "african": 0.0}}

# Face shaped against the character sheet (values 0..1 on MakeHuman targets).
FACE = {
    "head-oval": 0.55, "head-scale-vert-incr": 0.18, "head-scale-horiz-decr": 0.12, "head-age-incr": 0.1,
    "forehead-scale-vert-incr": 0.35, "forehead-temple-decr": 0.2,
    "chin-width-decr": 0.3, "chin-prominent-incr": 0.25, "chin-height-incr": 0.15,
    "l-cheek-volume-decr": 0.35, "r-cheek-volume-decr": 0.35, "l-cheek-bones-incr": 0.25, "r-cheek-bones-incr": 0.25,
    "nose-scale-vert-incr": 0.3, "nose-point-width-decr": 0.25, "nose-hump-incr": 0.1, "nose-width1-decr": 0.15,
    "nose-trans-forward": 0.1,
    "mouth-upperlip-volume-decr": 0.35, "mouth-lowerlip-volume-decr": 0.15, "mouth-scale-horiz-decr": 0.1,
    "l-ear-flap-incr": 0.35, "r-ear-flap-incr": 0.32, "l-ear-scale-incr": 0.15, "r-ear-scale-incr": 0.15,
    "l-eye-scale-decr": 0.1, "r-eye-scale-decr": 0.1, "l-eye-bag-incr": 0.35, "r-eye-bag-incr": 0.35,
    "neck-scale-horiz-decr": 0.25, "neck-scale-vert-incr": 0.2, "eyebrows-trans-down": 0.15,
}


def mpfb(pkg, key):
    for m in list(sys.modules):
        if m.endswith(pkg):
            return getattr(importlib.import_module(m), key)
    raise ImportError(pkg)


def enable_mpfb():
    bpy.ops.wm.read_userpref()
    addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)


def skin_material():
    """Skin: base tone + redness zones + pores + SSS. Region masks come from MPFB's UV masks."""
    tex = Path(sys.modules[[m for m in sys.modules if m.endswith("mpfb.services.locationservice")][0]]
               .LocationService.get_mpfb_data("textures"))
    mat = M._new("Ivan Skin")
    k = M.NodeKit(mat)
    uv = k.node("ShaderNodeTexCoord")
    p, po = k.pos()
    base = (0.36, 0.215, 0.155)
    # Low-frequency mottling.
    n1 = k.node("ShaderNodeTexNoise", Scale=60.0, Detail=6.0, Roughness=0.55)
    k.link(p, po, n1, "Vector")
    tone = k.ramp(n1, "Fac", [(0.35, (base[0] * 0.92, base[1] * 0.86, base[2] * 0.86)), (0.65, (base[0] * 1.03, base[1] * 1.0, base[2] * 0.98))])
    col = tone
    # Redness on lips/ears/eyelids via MPFB masks.
    for mask_name, tint, amt in (("mpfb_lips.jpg", (0.55, 0.25, 0.22), 0.75), ("mpfb_ears.jpg", (0.66, 0.36, 0.3), 0.4),
                                 ("mpfb_eyelids.jpg", (0.55, 0.32, 0.3), 0.45)):
        img = k.node("ShaderNodeTexImage")
        img.image = bpy.data.images.load(str(tex / mask_name), check_existing=True)
        img.image.colorspace_settings.name = "Non-Color"
        k.link(uv, "UV", img, "Vector")
        f = k.node("ShaderNodeMath", _operation="MULTIPLY", Value=amt)
        f.inputs[1].default_value = amt
        k.link(img, "Color", f, 0)
        mix = k.node("ShaderNodeMix", _data_type="RGBA")
        k.link(f, 0, mix, 0)
        k.link(col, "Color" if col is tone else 2, mix, 6)
        mix.inputs[7].default_value = (*tint, 1)
        col = mix
    k.link(col, "Color" if col is tone else 2, k.bsdf, "Base Color")
    # Pores + fine wrinkles as bump; roughness varies (T-zone a little shinier).
    pores = k.node("ShaderNodeTexVoronoi", Scale=2600.0)
    k.link(p, po, pores, "Vector")
    fine = k.node("ShaderNodeTexNoise", Scale=900.0, Detail=8.0)
    k.link(p, po, fine, "Vector")
    add = k.node("ShaderNodeMath", _operation="ADD")
    k.link(pores, "Distance", add, 0)
    k.link(fine, "Fac", add, 1)
    k.bump(add, 0, strength=0.12, distance=0.0004)
    rough = k.ramp(n1, "Fac", [(0.3, (0.38,) * 3), (0.7, (0.52,) * 3)])
    k.link(rough, "Color", k.bsdf, "Roughness")
    k.set(**{"Subsurface Weight": 1.0, "Subsurface Radius": (1.0, 0.35, 0.18), "Subsurface Scale": 0.004,
             "Specular IOR Level": 0.45, "Coat Weight": 0.08, "Coat Roughness": 0.35})
    mat.node_tree.nodes["Principled BSDF"].subsurface_method = "RANDOM_WALK_SKIN"
    return mat


def eye_material():
    img = MH_DATA / "eyes" / "materials" / "brown_eye.png"
    mat = M._new("Ivan Eyes")
    k = M.NodeKit(mat)
    t = k.node("ShaderNodeTexImage")
    t.image = bpy.data.images.load(str(img), check_existing=True)
    uv = k.node("ShaderNodeTexCoord")
    k.link(uv, "UV", t, "Vector")
    k.link(t, "Color", k.bsdf, "Base Color")
    k.set(Roughness=0.05, **{"Coat Weight": 1.0, "Coat Roughness": 0.0, "Subsurface Weight": 0.1})
    return mat


def build_body():
    HumanService = mpfb("mpfb.services.humanservice", "HumanService")
    TargetService = mpfb("mpfb.services.targetservice", "TargetService")
    body = HumanService.create_human(macro_detail_dict=MACROS)
    body.name = "Ivan_Body"
    for name, val in FACE.items():
        try:
            TargetService.load_target(body, TargetService.target_full_path(name), weight=val, name=name)
        except Exception as e:  # keep going: one missing target shouldn't stop the build
            print("target skipped", name, e)
    rig = HumanService.add_builtin_rig(body, "mixamo")
    rig.name = "Ivan_Rig"
    eyes = HumanService.add_mhclo_asset(str(MH_DATA / "eyes" / "high-poly" / "high-poly.mhclo"), body,
                                        asset_type="Eyes", subdiv_levels=0, material_type="PROCEDURAL_EYES")
    eyes.name = "Ivan_Eyes"
    eyes.data.materials.clear()
    eyes.data.materials.append(eye_material())
    skin = skin_material()
    body.data.materials.clear()
    body.data.materials.append(skin)
    for poly in body.data.polygons:
        poly.material_index = 0
    return body, rig, eyes


def turnaround(out_dir, res=(1600, 900), samples=64, only=None):
    """Character-sheet style stills: front, 3/4, side, back + face close-up, neutral grey studio."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("Studio")
    w.color = (0.02, 0.02, 0.022)
    scene.world = w
    c = geo.coll("Studio")
    floor = M.paint("Studio Floor", (0.03, 0.03, 0.032), 0.6)
    geo.box("Studio_Floor", (20, 20, 0.01), (0, 0, -0.01), floor, c, bev=0)
    for name, loc, energy, color, size in (("Key", (-1.6, -2.2, 2.6), 320, (1.0, 0.93, 0.85), 1.2),
                                           ("Rim", (1.8, 1.8, 2.4), 260, (0.8, 0.88, 1.0), 0.8),
                                           ("Fill", (2.2, -2.0, 1.2), 50, (0.9, 0.92, 1.0), 2.0)):
        d = bpy.data.lights.new(name, "AREA")
        d.energy, d.color, d.size = energy, color, size
        o = bpy.data.objects.new(name, d)
        c.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    eyes_obj = bpy.data.objects.get("Ivan_Eyes")
    head_z = (eyes_obj.matrix_world @ (sum((v.co for v in eyes_obj.data.vertices), Vector()) / len(eyes_obj.data.vertices))).z if eyes_obj else 1.7
    shots = {"front": (0, -4.2, 1.0, 0, 0.95, 55), "q34": (-2.9, -3.0, 1.0, 0, 0.95, 55),
             "side": (-4.2, 0, 1.0, 0, 0.95, 55), "back": (0, 4.2, 1.0, 0, 0.95, 55),
             "face": (-0.25, -0.75, head_z + 0.02, 0, head_z, 85), "face_side": (-0.78, -0.05, head_z + 0.02, 0, head_z, 85)}
    paths = []
    for name, (x, y, z, tx, tz, mm) in shots.items():
        if only and name not in only:
            continue
        cam = bpy.data.cameras.new(name)
        cam.lens = mm
        o = bpy.data.objects.new(f"Cam_{name}", cam)
        c.objects.link(o)
        o.location = (x, y, z)
        o.rotation_euler = (Vector((tx, 0, tz)) - Vector((x, y, z))).to_track_quat("-Z", "Y").to_euler()
        scene.camera = o
        scene.render.resolution_x, scene.render.resolution_y = (700, 1100) if not name.startswith("face") else (900, 900)
        scene.render.filepath = str(out_dir / f"ivan_{name}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


if __name__ == "__main__":
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    enable_mpfb()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    enable_mpfb()
    body, rig, eyes = build_body()
    try:
        import ivan_wardrobe
        ivan_wardrobe.dress(body, rig)
    except ImportError:
        pass
    if "--blend" in sys.argv:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / "ivan.blend"))
    if "--turnaround" in sys.argv:
        args = sys.argv
        samples = int(args[args.index("--samples") + 1]) if "--samples" in args else 64
        only = args[args.index("--shots") + 1].split(",") if "--shots" in args else None
        print("rendered", turnaround(out, samples=samples, only=only))
