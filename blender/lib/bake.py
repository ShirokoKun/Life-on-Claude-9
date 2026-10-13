"""Bake Cycles lighting + materials into textures so three.js shows what Blender computed.

Static set:  objects are grouped (architecture / desk zone / room), joined per group, given a
             fresh lightmap UV, and baked with the DIFFUSE pass (direct + indirect + colour):
             the 3 AM light, bounce and soft shadows, on the real materials. Glossy is left to
             three.js (view-dependent), emissive/transparent things stay live.
Ivan:        colour (albedo incl. blush + crease shading) and normal (knit, pores) maps on his
             own UVs; he is lit live in three.js because he moves.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector

SKIP_MAT = ("Glass", "Water", "Air Bubble", "Carafe", "Bottle", "Lens", "Sheer Curtain", "Screen", "LED", "Fairy Bulb",
            "Coffee Ring", "Lamp", "Diffuser_On", "Sodium", "Aviation", "Tail Light", "Coffee Maker Clock", "Facade",
            "Haze", "Dust", "Hair", "Brows", "Lashes")
DESK = Vector((6.95, 3.2, 0.0))


def _mat_names(o):
    return [s.material.name for s in o.material_slots if s.material]


def _skip(o):
    if o.type != "MESH" or not o.visible_get():
        return True
    if any(c.name in ("Ivan", "Exterior", "Lighting", "Shots", "Cameras") for c in o.users_collection):
        return True
    names = _mat_names(o)
    return not names or any(any(k in n for k in SKIP_MAT) for n in names)


def _group(o):
    c = o.matrix_world.translation
    n = o.name
    if n.startswith(("Wall", "Floor", "Ceiling", "Skirting", "Door", "Window", "Balcony", "Fixture", "Switch", "Outlet",
                     "Thermostat", "Slab", "Railing", "Frame_", "Casing", "Lining")) or \
       any(cl.name == "Structure" for cl in o.users_collection):
        return "ARCH"
    if (Vector((c.x, c.y, 0)) - DESK).length < 2.0:
        return "DESK"
    return "ROOM"


def _join(objs, name):
    """Duplicate-free join: apply modifiers into one mesh with all material slots."""
    dg = bpy.context.evaluated_depsgraph_get()
    import bmesh
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
        me.transform(o.matrix_world)
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        for p in me.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll = bpy.data.collections.get("Baked") or bpy.data.collections.new("Baked")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    coll.objects.link(ob)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)      # the exporter would still write hidden originals
    return ob


def _lightmap_uv(ob):
    uv = ob.data.uv_layers.new(name="LM")
    ob.data.uv_layers.active = uv
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    return uv


def _targets(ob, img):
    """Every material on the object gets a selected+active image node (materials copied so other
    objects keep theirs)."""
    for slot in ob.material_slots:
        if not slot.material:
            continue
        m = slot.material.copy()
        slot.material = m
        if not m.use_nodes:
            m.use_nodes = True
        nt = m.node_tree
        for n in nt.nodes:
            n.select = False
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.name = "BAKE_TARGET"
        node.select = True
        nt.nodes.active = node


def denoise_image(img, out_path):
    """OIDN through the compositor on a baked texture (CPU)."""
    scene = bpy.context.scene
    tmp = bpy.data.scenes.new("DenoiseTmp")
    tmp.render.resolution_x, tmp.render.resolution_y = img.size
    tmp.render.resolution_percentage = 100
    tmp.render.compositor_device = "CPU"
    tree = bpy.data.node_groups.new("Denoise", "CompositorNodeTree")
    tmp.compositing_node_group = tree
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    i = tree.nodes.new("CompositorNodeImage")
    i.image = img
    d = tree.nodes.new("CompositorNodeDenoise")
    o = tree.nodes.new("NodeGroupOutput")
    tree.links.new(i.outputs["Image"], d.inputs["Image"])
    tree.links.new(d.outputs["Image"], o.inputs[0])
    tmp.render.use_compositing = True
    tmp.render.use_sequencer = False
    tmp.render.filepath = str(out_path)
    tmp.render.image_settings.file_format = "PNG"
    tmp.view_settings.view_transform = "Standard"      # store linear-ish light, no film curve (three.js tone-maps)
    tmp.view_settings.look = "None"
    tmp.view_settings.exposure = 1.5                   # x2.83: night light needs the 8-bit range; three.js divides back
    tmp.camera = scene.camera
    try:
        with bpy.context.temp_override(scene=tmp):
            bpy.ops.render.render(write_still=True, scene=tmp.name)
        res = bpy.data.images.load(str(out_path), check_existing=False)
    except Exception as e:  # if the compositor path fails, keep the raw bake
        print("denoise skipped:", e)
        img.filepath_raw = str(out_path)
        img.file_format = "PNG"
        img.save()
        res = img
    bpy.data.scenes.remove(tmp)
    return res


def bake_set(out_dir, sizes=None, samples=48):
    sizes = sizes or {"ARCH": 4096, "DESK": 4096, "ROOM": 2048}   # texel density: floor planks, wood grain, paper
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 6
    groups = {}
    for o in list(bpy.data.objects):
        if not _skip(o):
            groups.setdefault(_group(o), []).append(o)
    baked = {}
    for g, objs in groups.items():
        ob = _join(objs, f"Baked_{g}")
        _lightmap_uv(ob)
        img = bpy.data.images.new(f"bake_{g}", sizes[g], sizes[g], float_buffer=True)
        _targets(ob, img)
        bpy.ops.object.select_all(action="DESELECT")
        ob.hide_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        print("baking", g, len(objs), "objects", sizes[g])
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT", "COLOR"}, use_clear=True, margin=6)
        clean = denoise_image(img, out_dir / f"bake_{g}.png")
        rough = bpy.data.images.new(f"rough_{g}", sizes[g] // 2, sizes[g] // 2, float_buffer=False)
        rough.colorspace_settings.name = "Non-Color"
        for slot in ob.material_slots:                  # retarget the bake node to the roughness image
            if slot.material:
                slot.material.node_tree.nodes["BAKE_TARGET"].image = rough
        scene.cycles.samples, keep = 1, scene.cycles.samples
        bpy.ops.object.bake(type="ROUGHNESS", use_clear=True, margin=4)
        scene.cycles.samples = keep
        rough.filepath_raw = str(out_dir / f"rough_{g}.png")
        rough.file_format = "PNG"
        rough.save()
        _finalize(ob, clean, g, rough)
        baked[g] = ob
    return baked


def _finalize(ob, img, g, rough=None):
    """Replace all slots with one material: baked light as emission-like base (exported as baseColor,
    read in three.js as a lightmapped surface)."""
    m = bpy.data.materials.new(f"Baked_{g}")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "LM"
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    if rough:                                           # walnut and floor stay glossy, plaster stays matte
        rt = nt.nodes.new("ShaderNodeTexImage")
        rt.image = rough
        nt.links.new(uvn.outputs["UV"], rt.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(rt.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    ob.data.materials.clear()
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.material_index = 0
    # keep only the lightmap UV so the exporter writes it as TEXCOORD_0
    for uv in list(ob.data.uv_layers):
        if uv.name != "LM":
            ob.data.uv_layers.remove(uv)


def bake_character_maps(out_dir, size=2048):
    """Albedo (+ normal for cloth) on Ivan's own UVs."""
    out_dir = Path(out_dir)
    scene = bpy.context.scene
    scene.cycles.samples = 4
    for name, normal in (("Ivan_Body", False), ("Ivan_Sweater", True), ("Ivan_Trousers", True), ("Ivan_HairShell", True)):
        ob = bpy.data.objects.get(name)
        if not ob or not ob.data.uv_layers:
            continue
        for kind in (("DIFFUSE", "albedo"),) + ((("NORMAL", "normal"),) if normal else ()):
            img = bpy.data.images.new(f"{name}_{kind[1]}", size, size, float_buffer=False)
            if kind[1] == "normal":
                img.colorspace_settings.name = "Non-Color"
            _targets(ob, img)
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            if kind[0] == "DIFFUSE":
                bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_clear=True, margin=8)
            else:
                bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_clear=True, margin=8)
            path = out_dir / f"{name}_{kind[1]}.png"
            img.filepath_raw = str(path)
            img.file_format = "PNG"
            img.save()
            ob[f"bake_{kind[1]}"] = str(path)
            print("baked", name, kind[1])
        _char_material(ob)


def _char_material(ob):
    """One clean Principled material per character object, driven by the baked maps."""
    old = ob.material_slots[0].material if ob.material_slots else None
    base_name = (old.name.split(".")[0] if old else ob.name)
    m = bpy.data.materials.new(base_name + " Baked")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    if ob.get("bake_albedo"):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(ob["bake_albedo"], check_existing=True)
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if ob.get("bake_normal"):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(ob["bake_normal"], check_existing=True)
        t.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.6
    ob.data.materials.clear()
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.material_index = 0


# Ivan: bake what Cycles computes on him (skin subsurface, knit sheen, contact shadows, bounce) in
# the seated pose. He only types, breathes and glances, so baked light holds; three.js adds the
# moving speculars on top. Eyes stay live (cornea shell + iris would bake into each other).
CHAR_LIGHT = {"Ivan_Body": 2048, "Ivan_Sweater": 1024, "Ivan_Trousers": 1024, "Ivan_HairShell": 512,
              "Ivan_ShirtCollar": 512}


def bake_character_light(out_dir, samples=48, sizes=None, reuse=False):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = True
    for name, size in (sizes or CHAR_LIGHT).items():
        ob = bpy.data.objects.get(name)
        if not ob or ob.type != "MESH":
            continue
        _lightmap_uv(ob)                                  # unique islands (MakeHuman/garment UVs may overlap)
        path = out_dir / f"lit_{name}.png"
        if reuse and path.exists():                       # same mesh -> same smart-UV islands
            clean = bpy.data.images.load(str(path), check_existing=False)
            print("reused light", name)
        else:
            img = bpy.data.images.new(f"lit_{name}", size, size, float_buffer=True)
            _targets(ob, img)
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            print("baking light", name, size)
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT", "COLOR"}, use_clear=True, margin=8)
            clean = denoise_image(img, path)
        old = ob.material_slots[0].material if ob.material_slots else None
        base = old.name.split(".")[0] if old else name
        m = bpy.data.materials.new(base + " Lit")
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = clean
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "LM"
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        ob.data.materials.clear()
        ob.data.materials.append(m)
        for p in ob.data.polygons:
            p.material_index = 0
        for uv in list(ob.data.uv_layers):
            if uv.name != "LM":
                ob.data.uv_layers.remove(uv)
