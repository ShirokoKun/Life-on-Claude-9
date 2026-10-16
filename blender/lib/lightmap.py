"""Mixed-lighting lightmaps for the three.js engine (the EEVEE/Unity 'baked indirect' model).

Static surfaces keep their real materials (three.js gives them high-res PBR textures); what Cycles
contributes is the light arriving at each point (irradiance), stored as linear HDR in a second UV set.

    lightmap = Cycles(all lights, direct + indirect)  -  Cycles(live lights only, direct)

The live lights (desk lamp, laptop key) are rebuilt in three.js with real-time shadows, so Ivan can
shadow the desk and the light can flicker; their bounce stays in the bake. Everything else (city,
sodium, string lights, bathroom, monitor glow) is baked only.

Values: Cycles' diffuse light pass is E/pi, so three.js reads the map with lightMapIntensity = pi.
"""
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

import bake as B

LIVE_LIGHTS = ("Desk_Lamp", "Key_Laptop")
EMISSIVE_HINTS = ("Screen", "LED", "Fairy Bulb", "Lamp_Bulb", "Diffuser_On", "Sodium", "Aviation", "Tail Light",
                  "Coffee Maker Clock", "Facade")


# ---------------------------------------------------------------------------------------------
# UVs: a metric box projection (1 UV unit = 1 m) so tiling textures have one texel density
def box_uv(ob):
    me = ob.data
    if me.uv_layers:                       # authored UVs (screens, prints, book spines) stay
        first = me.uv_layers[0]
        first.name = "UVMap"
        for uv in list(me.uv_layers)[1:]:
            me.uv_layers.remove(uv)
        return
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.new("UVMap")
    s = ob.matrix_world.to_scale()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            co = lp.vert.co
            p = (co.x * s.x, co.y * s.y, co.z * s.z)
            if ax == 0:
                u, v = p[1] * (1 if n.x > 0 else -1), p[2]
            elif ax == 1:
                u, v = p[0] * (-1 if n.y > 0 else 1), p[2]
            else:
                u, v = p[0], p[1] * (1 if n.z > 0 else -1)
            lp[uvl].uv = (u, v)
    bm.to_mesh(me)
    bm.free()


def _join_keep(objs, name):
    """Join into one mesh, keeping every material slot (three.js maps them to PBR sets by name)."""
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
        me.transform(o.matrix_world)
        if not me.uv_layers:
            me.uv_layers.new(name="UVMap")
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
        bpy.data.objects.remove(o, do_unlink=True)
    return ob


def _bake_into(ob, img, passes):
    for slot in ob.material_slots:
        if slot.material:
            slot.material.node_tree.nodes["BAKE_TARGET"].image = img
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="DIFFUSE", pass_filter=passes, use_clear=True, margin=8)


def _pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def _denoised(img, path):
    """OIDN via the compositor, written as half-float EXR (linear), returned as a numpy array."""
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
    tmp.render.filepath = str(path)
    st = tmp.render.image_settings
    st.file_format = "OPEN_EXR"
    st.color_depth = "32"
    st.exr_codec = "ZIP"
    tmp.camera = scene.camera
    with bpy.context.temp_override(scene=tmp):
        bpy.ops.render.render(write_still=True, scene=tmp.name)
    bpy.data.scenes.remove(tmp)
    res = bpy.data.images.load(str(path), check_existing=False)
    arr = _pixels(res).copy()
    bpy.data.images.remove(res)
    return arr


def _save_exr(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(path.stem, w, h, float_buffer=True, alpha=False)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = str(path)
    img.file_format = "OPEN_EXR"
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.exr_codec = "ZIP"
    img.save_render(str(path), scene=scene)
    bpy.data.images.remove(img)


def unblock_live_lights():
    """Emitter meshes that wrap a light (the lamp bulb around the spot, the screen in front of the key) must
    not shadow it, or Cycles keeps only a fraction of that light while three.js shows all of it."""
    for o in bpy.data.objects:
        if o.type == "MESH" and any(any(h in s.material.name for h in EMISSIVE_HINTS) for s in o.material_slots if s.material):
            o.visible_shadow = False


def _emission_sockets():
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                yield n.inputs["Emission Strength"]
            elif n.type == "EMISSION":
                yield n.inputs["Strength"]


def _live_only(on):
    """Switch the scene between 'everything' and 'only the live lights, direct' for the second bake.
    Emitters are switched off (not hidden), so the geometry, and every shadow, is identical in both bakes."""
    state = []
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name not in LIVE_LIGHTS:
            state.append((o, o.hide_render))
            o.hide_render = on
    for sock in _emission_sockets():
        state.append((sock, sock.default_value))
        if on:
            sock.default_value = 0.0
    w = bpy.context.scene.world
    if w and w.use_nodes:
        bg = next((n for n in w.node_tree.nodes if n.type == "BACKGROUND"), None)
        if bg:
            state.append((bg, bg.inputs["Strength"].default_value))
            bg.inputs["Strength"].default_value = 0.0 if on else bg.inputs["Strength"].default_value
    return state


def _restore(state):
    for obj, v in state:
        if isinstance(obj, bpy.types.Object):
            obj.hide_render = v
        elif isinstance(obj, bpy.types.NodeSocket):
            obj.default_value = v
        else:
            obj.inputs["Strength"].default_value = v


def bake_lightmaps(out_dir, sizes=None, samples=64, live_samples=24, reuse=False, device="CPU"):
    sizes = sizes or {"ARCH": 4096, "DESK": 4096, "ROOM": 2048}
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = device
    if device == "GPU":                              # OptiX (or CUDA) on the laptop's GTX 1650
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "METAL"):             # METAL: the Mac
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    break
            except TypeError:
                continue
        for d in prefs.devices:
            d.use = d.type != "CPU"
        print("baking on", prefs.compute_device_type, [d.name for d in prefs.devices if d.use], flush=True)
    scene.render.bake.margin = 8

    unblock_live_lights()
    groups = {}
    for o in list(bpy.data.objects):
        if not B._skip(o):
            groups.setdefault(B._group(o), []).append(o)
    for o in bpy.data.objects:                       # every exported mesh gets tiling UVs
        if o.type == "MESH" and o.data.users == 1:
            box_uv(o)

    baked = {}
    for g, objs in groups.items():
        for o in objs:
            box_uv(o)
        ob = _join_keep(objs, f"Baked_{g}")
        originals = [s.material for s in ob.material_slots]
        B._lightmap_uv(ob)                           # second UV set "LM"
        ob.data.uv_layers.active_index = 0
        ob.data.uv_layers["UVMap"].active_render = True
        ob.data.uv_layers.active = ob.data.uv_layers["LM"]   # bake writes into LM
        size = sizes[g]
        if reuse and (out_dir / f"lm_{g}.exr").exists():   # resumable: smart-UV islands are deterministic
            ob.data.uv_layers.active = ob.data.uv_layers["UVMap"]
            ob["lightmap"] = f"lm_{g}.exr"
            baked[g] = ob
            print("reused", g, flush=True)
            continue
        full = bpy.data.images.new(f"lm_{g}_full", size, size, float_buffer=True)
        live = bpy.data.images.new(f"lm_{g}_live", size, size, float_buffer=True)
        B._targets(ob, full)
        print("baking", g, len(objs), "objects", size, flush=True)
        scene.cycles.samples = samples
        _bake_into(ob, full, {"DIRECT", "INDIRECT"})
        a = _denoised(full, out_dir / f"lm_{g}_full.exr")
        st = _live_only(True)
        scene.cycles.samples = live_samples
        _bake_into(ob, live, {"DIRECT"})
        _restore(st)
        b = _denoised(live, out_dir / f"lm_{g}_live.exr")
        lm = np.clip(a - b, 0.0, None)
        lm[..., 3] = 1.0
        _save_exr(lm, out_dir / f"lm_{g}.exr")
        print("lightmap", g, "mean", float(lm[..., :3].mean()), flush=True)
        # put the real materials back; UVMap first (TEXCOORD_0), LM second (TEXCOORD_1)
        for slot, m in zip(ob.material_slots, originals):
            copy = slot.material
            slot.material = m
            if copy is not m:
                bpy.data.materials.remove(copy)
        ob.data.uv_layers.active = ob.data.uv_layers["UVMap"]
        ob["lightmap"] = f"lm_{g}.exr"
        baked[g] = ob
        for im in (full, live):
            bpy.data.images.remove(im)
    return baked
