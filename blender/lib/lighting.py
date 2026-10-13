"""Lighting presets for the intro (motivated sources only) + the film look in the compositor.

Reference logic (OpenKnight stills): every light has a visible cause, warm/cool contrast,
deep but not dead blacks, practicals bloom, highlights streak horizontally.

Presets:
  3am      laptop key (cool), sodium streetlight bounce on the ceiling (warm), cold city
           spill through the east window and balcony door, bathroom light left on behind him.
  4am      same sources, city dimmer, first blue hour in the sky, screen feels brighter.
  sunrise  low warm sun through the east window raking across desk and floor; screen weak.
"""
import math

import bpy
from mathutils import Vector

import geo

PRESETS = {
    "3am":     dict(sky_top=(0.002, 0.003, 0.009), sky_bottom=(0.03, 0.018, 0.01), sky_str=1.0,
                    screen=3.0, screen_light=4.0, sodium=1400, city_east=30, city_north=30, bath=55, sun=0.0,
                    exposure=1.35, city_windows=1.0, lamp=24, fairy=1.0, haze=0.010),
    "4am":     dict(sky_top=(0.006, 0.010, 0.03), sky_bottom=(0.02, 0.02, 0.035), sky_str=1.0,
                    screen=3.4, screen_light=4.6, sodium=1000, city_east=40, city_north=40, bath=55, sun=0.0,
                    exposure=1.35, city_windows=0.55, lamp=24, fairy=1.0, haze=0.010),
    "sunrise": dict(sky_top=(0.12, 0.16, 0.30), sky_bottom=(0.9, 0.5, 0.25), sky_str=2.0,
                    screen=1.2, screen_light=0.8, sodium=0, city_east=0, city_north=0, bath=0, sun=5.5,
                    exposure=0.2, city_windows=0.05, lamp=0, fairy=0.4, haze=0.02),
}


def _light(name, kind, loc, energy, color, coll, size=None, spot=None, target=None, shadow_soft=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA" and size:
        data.shape = "RECTANGLE"
        data.size, data.size_y = size
    if kind == "SPOT" and spot:
        data.spot_size = math.radians(spot[0])
        data.spot_blend = spot[1]
    if shadow_soft is not None:
        data.shadow_soft_size = shadow_soft
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    obj.location = loc
    obj.visible_camera = False          # light panels must never show up through the windows
    obj.visible_transmission = False    # ...or through the glass
    obj.visible_glossy = name.startswith(("Key_", "Bath_"))
    if target is not None:
        d = Vector(target) - Vector(loc)
        obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return obj


def clear_shell_lights():
    for o in list(bpy.data.objects):
        if o.type == "LIGHT":
            bpy.data.objects.remove(o, do_unlink=True)
    # Window panes must not block light from outside in Cycles (no caustics).
    for o in bpy.data.objects:
        if o.name.startswith("Pane_") or "Glass" in o.name and o.type == "MESH" and o.name.startswith(("Window", "Balcony")):
            o.visible_shadow = False


def world_sky(top, bottom, strength):
    w = bpy.data.worlds.get("Sky") or bpy.data.worlds.new("Sky")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.0, (*bottom, 1)
    cr.elements[1].position, cr.elements[1].color = 0.35, (*top, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bpy.context.scene.world = w


def apply(preset="3am"):
    p = PRESETS[preset]
    clear_shell_lights()
    c = geo.coll("Lighting")
    world_sky(p["sky_top"], p["sky_bottom"], p["sky_str"])

    # Laptop key: an area light just in front of the screen, aimed at Ivan's face height.
    scr = bpy.data.materials.get("Laptop Screen")
    if scr:
        scr.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = p["screen"]
    hinge = bpy.data.objects.get("Laptop_Hinge")
    if hinge and p["screen_light"]:
        bpy.context.view_layer.update()
        centre = hinge.matrix_world @ Vector((0, -0.01, 0.112))
        _light("Key_Laptop", "AREA", centre, p["screen_light"], (0.62, 0.74, 1.0), c, size=(0.29, 0.18),
               target=(6.95, 2.55, 1.15))

    # Sodium streetlights in the lot below: warm pools thrown up onto the ceiling through the windows.
    if p["sodium"]:
        for i, (y, tx) in enumerate(((3.0, 7.6), (4.3, 8.2))):
            _light(f"Sodium_{i}", "SPOT", (14.0, y, 0.3), p["sodium"], (1.0, 0.50, 0.16), c,
                   spot=(14, 0.7), target=(tx, y + 0.2, 2.7), shadow_soft=0.3)
        _light("Sodium_Balcony", "SPOT", (4.6, 12.0, 0.2), p["sodium"] * 0.7, (1.0, 0.55, 0.2), c,
               spot=(14, 0.7), target=(4.6, 4.2, 2.7), shadow_soft=0.3)
    # Cold city glow: big soft panels outside the openings.
    if p["city_east"]:
        _light("City_East", "AREA", (10.9, 3.6, 1.7), p["city_east"], (0.30, 0.42, 1.0), c, size=(2.6, 1.6),
               target=(6.0, 3.6, 0.9))
    if p["city_north"]:
        _light("City_North", "AREA", (4.75, 8.4, 1.6), p["city_north"], (0.55, 0.5, 0.9), c, size=(2.4, 1.8),
               target=(4.75, 3.0, 0.8))
    # He left the bathroom light on: warm tungsten spilling from the half-open door behind him.
    if p["bath"]:
        _light("Bath_E_Practical", "POINT", (7.9, 1.15, 2.45), p["bath"], (1.0, 0.72, 0.45), c, shadow_soft=0.06)
        for o in bpy.data.objects:
            if o.name == "Fixture_CeilingLight_Bath_E":
                _glow(o, (1.0, 0.8, 0.6), 12.0)
    # Desk lamp ON: the warm pool on the desk against the cold screens (Birdcage ref).
    if p.get("lamp"):
        shade = Vector((7.58 - 0.16, 3.48 - 0.10, 0.75 + 0.40))
        lamp = _light("Desk_Lamp", "SPOT", shade, p["lamp"], (1.0, 0.60, 0.30), c, spot=(85, 0.75),
                      target=(7.05, 3.10, 0.75), shadow_soft=0.02)
        lamp.visible_glossy = True
        bulb = bpy.data.materials.get("Fairy Bulb")
        geo_bulb = bpy.data.objects.get("Lamp_Shade")
        if geo_bulb and bulb:
            import geo as _g
            _g.cyl("Lamp_Bulb", 0.018, 0.02, tuple(shade - Vector((0, 0, 0.015))), bulb, c, seg=16)
    # Fairy lights: emissive bulbs + a few soft fills so the wall actually catches their warmth.
    fb = bpy.data.materials.get("Fairy Bulb")
    if fb:
        fb.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 30.0 * p.get("fairy", 1.0)
        for i, x in enumerate((6.3, 7.3, 8.2)):
            _light(f"Fairy_Fill_{i}", "POINT", (x, 2.25, 2.08), 2.5 * p.get("fairy", 1.0), (1.0, 0.6, 0.3), c, shadow_soft=0.3)
    # Haze: a thin scattering volume filling the flat so lights carve shafts and depth falls off.
    if p.get("haze"):
        haze(p["haze"])
        dust_motes(c)
    # Sunrise.
    if p["sun"]:
        sun = bpy.data.lights.new("Sun_Sunrise", "SUN")
        sun.energy = p["sun"]
        sun.angle = math.radians(1.2)
        sun.color = (1.0, 0.62, 0.36)
        o = bpy.data.objects.new("Sun_Sunrise", sun)
        c.objects.link(o)
        az, el = math.radians(100), math.radians(9)   # from north, clockwise: just south of east
        d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
        o.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        _light("Sky_Fill_East", "AREA", (10.6, 3.6, 1.6), 40, (0.55, 0.65, 1.0), c, size=(2.6, 1.6), target=(6, 3.6, 1))
    bpy.context.scene.view_settings.exposure = p["exposure"]
    return p


def haze(density):
    import geo as _g
    mat = bpy.data.materials.get("Room Haze") or bpy.data.materials.new("Room Haze")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vs = nt.nodes.new("ShaderNodeVolumeScatter")
    vs.inputs["Density"].default_value = density
    vs.inputs["Anisotropy"].default_value = 0.45
    vs.inputs["Color"].default_value = (0.85, 0.9, 1.0, 1)
    nt.links.new(vs.outputs[0], out.inputs["Volume"])
    box = _g.box("Room_Haze_Volume", (10.0, 7.7, 2.69), (5.0, 3.85, 0.005), mat, _g.coll("Lighting"), bev=0)
    box.visible_shadow = False
    scene = bpy.context.scene
    scene.cycles.volume_bounces = 1
    scene.cycles.volume_step_rate = 4.0
    return box


def dust_motes(coll, count=650, seed=4):
    """Floating dust: tiny specks around the desk light and the lamp pool (bokeh sparkles in DOF)."""
    import random as _r
    import geo as _g
    rr = _r.Random(seed)
    mat = bpy.data.materials.get("Dust") or bpy.data.materials.new("Dust")
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.9, 0.88, 0.82, 1)
    b.inputs["Roughness"].default_value = 0.6
    pts = []
    for _ in range(count):
        pts.append((rr.uniform(6.2, 7.8), rr.uniform(2.4, 3.9), rr.uniform(0.8, 2.0)))
    import bmesh as _bm
    bm = _bm.new()
    for p in pts:
        r = rr.uniform(0.0004, 0.0011)
        _bm.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=__import__("mathutils").Matrix.Translation(p))
    me = bpy.data.meshes.new("Dust_Motes")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Dust_Motes", me)
    coll.objects.link(o)
    me.materials.append(mat)
    o.visible_shadow = False
    return o


def _glow(obj, color, strength):
    """Make a fixture's diffuser emissive (by material slot named Diffuser)."""
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name.startswith("Diffuser"):
            mat = slot.material.copy()
            mat.name = f"Diffuser_On_{obj.name}"
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs["Emission Color"].default_value = (*color, 1)
            bsdf.inputs["Emission Strength"].default_value = strength
            slot.material = mat


# ---------------------------------------------------------------------------------------
def film_look(scene, streaks=True, strength=1.0):
    """Compositor: bloom + horizontal anamorphic streaks + lens dispersion + vignette.

    Runs on the CPU compositor (no GPU here). Tone: AgX 'Punchy'. Grain is added after
    save (deterministic per frame) by tools/post_grain.py when wanted.
    """
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.render.compositor_device = "CPU"
    tree = bpy.data.node_groups.new("Film Look", "CompositorNodeTree")
    scene.compositing_node_group = tree
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    N = tree.nodes.new
    rl = N("CompositorNodeRLayers")
    out = N("NodeGroupOutput")

    bloom = N("CompositorNodeGlare")
    bloom.inputs["Type"].default_value = "Bloom"
    bloom.inputs["Quality"].default_value = "High"
    bloom.inputs["Threshold"].default_value = 0.8
    bloom.inputs["Strength"].default_value = 0.5 * strength
    bloom.inputs["Size"].default_value = 0.6
    tree.links.new(rl.outputs["Image"], bloom.inputs["Image"])
    last = bloom

    if streaks:
        st = N("CompositorNodeGlare")
        st.inputs["Type"].default_value = "Streaks"
        st.inputs["Quality"].default_value = "High"
        st.inputs["Threshold"].default_value = 2.5
        st.inputs["Strength"].default_value = 0.35 * strength
        st.inputs["Streaks"].default_value = 2
        st.inputs["Streaks Angle"].default_value = 0.0
        st.inputs["Fade"].default_value = 0.94
        st.inputs["Tint"].default_value = (0.75, 0.85, 1.0, 1.0)
        tree.links.new(last.outputs["Image"], st.inputs["Image"])
        last = st

    # Halation: a wide, low-threshold glow tinted red-orange, like light bleeding through film layers.
    hal = N("CompositorNodeGlare")
    hal.inputs["Type"].default_value = "Bloom"
    hal.inputs["Quality"].default_value = "Medium"
    hal.inputs["Threshold"].default_value = 0.35
    hal.inputs["Strength"].default_value = 0.30 * strength
    hal.inputs["Size"].default_value = 0.85
    try:
        hal.inputs["Tint"].default_value = (1.0, 0.42, 0.22, 1.0)
        hal.inputs["Saturation"].default_value = 1.0
    except KeyError:
        pass
    tree.links.new(last.outputs["Image"], hal.inputs["Image"])
    last = hal
    # Depth haze from the mist pass: far things sink into teal.
    bpy.context.view_layer.use_pass_mist = True
    w = scene.world
    if w:
        w.mist_settings.start = 1.0
        w.mist_settings.depth = 14.0
        w.mist_settings.falloff = "QUADRATIC"
    fog = N("ShaderNodeMix")
    fog.data_type = "RGBA"
    fog.blend_type = "SCREEN"
    fog.inputs[7].default_value = (0.05, 0.085, 0.12, 1.0)
    try:
        tree.links.new(rl.outputs["Mist"], fog.inputs["Factor"])
    except KeyError:
        fog.inputs["Factor"].default_value = 0.0
    tree.links.new(last.outputs["Image"], fog.inputs[6])
    mistmul = N("ShaderNodeMath")
    mistmul.operation = "MULTIPLY"
    mistmul.inputs[1].default_value = 0.6
    try:
        tree.links.new(rl.outputs["Mist"], mistmul.inputs[0])
        tree.links.new(mistmul.outputs[0], fog.inputs["Factor"])
    except KeyError:
        pass

    class _Wrap:  # give the mix node an .outputs["Image"] like the glare nodes
        def __init__(self, n):
            self.outputs = {"Image": n.outputs[2]}
    last = _Wrap(fog)

    lens = N("CompositorNodeLensdist")
    try:
        lens.inputs["Dispersion"].default_value = 0.012
        lens.inputs["Distortion"].default_value = 0.0
    except KeyError:
        pass
    tree.links.new(last.outputs["Image"], lens.inputs["Image"])

    # Vignette: soft ellipse mask multiplied in.
    mask = N("CompositorNodeEllipseMask")
    for k, v in (("Size", (0.95, 0.95)),):
        try:
            mask.inputs[k].default_value = v
        except (KeyError, TypeError):
            pass
    blur = N("CompositorNodeBlur")
    try:
        blur.inputs["Size"].default_value = (400, 400)
    except (KeyError, TypeError):
        pass
    tree.links.new(mask.outputs[0], blur.inputs["Image"])
    mix = N("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.45
    tree.links.new(lens.outputs["Image"], mix.inputs[6])
    tree.links.new(blur.outputs[0], mix.inputs[7])
    tree.links.new(mix.outputs[2], out.inputs[0])
    scene.render.use_compositing = True
    return tree
