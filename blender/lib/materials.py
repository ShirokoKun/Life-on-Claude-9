"""Procedural PBR materials for the apartment (Cycles now, baked to textures for three.js later).

Every function returns a bpy material built from nodes, so nothing depends on downloaded
textures. Scales are in metres (Object/Generated coords are avoided; we use world-space
`Position` so tiling stays constant across differently sized meshes).
"""
import bpy


class NodeKit:
    """Tiny helper so node graphs read top to bottom."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new("ShaderNodeOutputMaterial")
        self.bsdf = self.nt.nodes.new("ShaderNodeBsdfPrincipled")
        self.link(self.bsdf, "BSDF", self.out, "Surface")

    def node(self, kind, **inputs):
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if k.startswith("_"):
                setattr(n, k[1:], v)
            else:
                n.inputs[k].default_value = v
        return n

    def link(self, a, a_out, b, b_in):
        self.nt.links.new(a.outputs[a_out] if isinstance(a_out, str) else a.outputs[a_out],
                          b.inputs[b_in] if isinstance(b_in, str) else b.inputs[b_in])

    def set(self, **kw):
        for k, v in kw.items():
            self.bsdf.inputs[k].default_value = v

    def pos(self, scale=(1, 1, 1)):
        geo = self.node("ShaderNodeNewGeometry")
        if scale == (1, 1, 1):
            return geo, "Position"
        m = self.node("ShaderNodeVectorMath", _operation="MULTIPLY")
        m.inputs[1].default_value = scale
        self.link(geo, "Position", m, 0)
        return m, "Vector"

    def ramp(self, src, src_out, stops):
        r = self.node("ShaderNodeValToRGB")
        cr = r.color_ramp
        cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
        cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
        for p, c in stops[1:-1]:
            e = cr.elements.new(p)
            e.color = (*c, 1)
        self.link(src, src_out, r, "Fac")
        return r

    def bump(self, height_node, height_out, strength=0.2, distance=0.002):
        b = self.node("ShaderNodeBump", Strength=strength, Distance=distance)
        self.link(height_node, height_out, b, "Height")
        self.link(b, "Normal", self.bsdf, "Normal")
        return b


def _new(name):
    old = bpy.data.materials.get(name)
    mat = old if old else bpy.data.materials.new(name)
    return mat


# ---------------------------------------------------------------------------------------
def plaster(name="Plaster", color=(0.42, 0.40, 0.37), rough=0.88):
    """Painted plaster: low-frequency tone drift + fine orange-peel bump."""
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    big = k.node("ShaderNodeTexNoise", Scale=0.8, Detail=3.0, Roughness=0.5)
    k.link(p, po, big, "Vector")
    tone = k.ramp(big, "Fac", [(0.3, tuple(c * 0.93 for c in color)), (0.7, tuple(min(1, c * 1.05) for c in color))])
    k.link(tone, "Color", k.bsdf, "Base Color")
    fine = k.node("ShaderNodeTexNoise", Scale=900.0, Detail=2.0)
    k.link(p, po, fine, "Vector")
    k.bump(fine, "Fac", strength=0.06, distance=0.001)
    k.set(Roughness=rough)
    return mat


def oak_floor(name="Floor"):
    """Engineered oak planks, 180 mm wide, 1.2 m long, staggered; per-plank tone + grain + seams."""
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    # Planks run along world X.
    brick = k.node("ShaderNodeTexBrick", Scale=1.0, **{"Mortar Size": 0.0012, "Brick Width": 1.2, "Row Height": 0.18,
                   "Color1": (1, 1, 1, 1), "Color2": (0.55, 0.55, 0.55, 1), "Mortar": (0, 0, 0, 1), "Bias": 0.0},
                   _offset=0.37, _offset_frequency=1, _squash=1.0)
    k.link(p, po, brick, "Vector")
    # Grain: stretched noise + wave along X.
    stretch, so = k.pos(scale=(0.6, 14.0, 14.0))
    grain = k.node("ShaderNodeTexNoise", Scale=3.0, Detail=8.0, Roughness=0.62, Distortion=0.4)
    k.link(stretch, so, grain, "Vector")
    wave = k.node("ShaderNodeTexWave", Scale=2.2, Distortion=6.0, **{"Detail": 3.0}, _wave_type="BANDS", _bands_direction="Y")
    k.link(stretch, so, wave, "Vector")
    mix_g = k.node("ShaderNodeMix", _data_type="FLOAT", Factor=0.35)
    k.link(grain, "Fac", mix_g, 2)
    k.link(wave, "Fac", mix_g, 3)
    wood = k.ramp(mix_g, 0, [(0.25, (0.20, 0.115, 0.06)), (0.55, (0.33, 0.20, 0.11)), (0.85, (0.42, 0.27, 0.15))])
    # Per-plank variation: brick colour output (random per brick) darkens/lightens.
    var = k.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=0.55)
    k.link(wood, "Color", var, 6)
    k.link(brick, "Color", var, 7)
    seam = k.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=1.0)
    k.link(var, 2, seam, 6)
    k.link(brick, "Fac", seam, 7)
    k.link(seam, 2, k.bsdf, "Base Color")
    # Satin lacquer with wear: roughness drifts 0.32..0.55.
    wear = k.node("ShaderNodeTexNoise", Scale=1.6, Detail=4.0)
    k.link(p, po, wear, "Vector")
    rough = k.ramp(wear, "Fac", [(0.3, (0.32, 0.32, 0.32)), (0.75, (0.55, 0.55, 0.55))])
    k.link(rough, "Color", k.bsdf, "Roughness")
    inv = k.node("ShaderNodeMath", _operation="SUBTRACT", Value=1.0)
    inv.inputs[0].default_value = 1.0
    k.link(brick, "Fac", inv, 1)
    k.bump(inv, 0, strength=0.4, distance=0.002)
    k.set(**{"Coat Weight": 0.25, "Coat Roughness": 0.18})
    return mat


def walnut(name="Walnut", base=(0.11, 0.06, 0.035), light=(0.24, 0.14, 0.08), grain_axis="X"):
    """Oiled walnut (desk top, bookshelf): long grain + figure."""
    mat = _new(name)
    k = NodeKit(mat)
    s = (0.5, 18.0, 18.0) if grain_axis == "X" else (18.0, 0.5, 18.0)
    p, po = k.pos(scale=s)
    wave = k.node("ShaderNodeTexWave", Scale=1.4, Distortion=9.0, Detail=4.0, **{"Detail Scale": 1.5},
                  _wave_type="BANDS", _bands_direction="Y" if grain_axis == "X" else "X")
    k.link(p, po, wave, "Vector")
    noise = k.node("ShaderNodeTexNoise", Scale=4.0, Detail=10.0, Roughness=0.6)
    k.link(p, po, noise, "Vector")
    mix = k.node("ShaderNodeMix", _data_type="FLOAT", Factor=0.4)
    k.link(wave, "Fac", mix, 2)
    k.link(noise, "Fac", mix, 3)
    col = k.ramp(mix, 0, [(0.2, base), (0.6, tuple((a + b) / 2 for a, b in zip(base, light))), (0.9, light)])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(noise, "Fac", strength=0.05, distance=0.001)
    k.set(Roughness=0.42, **{"Coat Weight": 0.15, "Coat Roughness": 0.3})
    return mat


def paint(name, color, rough=0.45, coat=0.0):
    """Satin/semi-gloss paint (trim, doors, cabinets, appliances)."""
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    n = k.node("ShaderNodeTexNoise", Scale=600.0, Detail=2.0)
    k.link(p, po, n, "Vector")
    k.bump(n, "Fac", strength=0.03, distance=0.0005)
    k.set(**{"Base Color": (*color, 1), "Roughness": rough, "Coat Weight": coat})
    return mat


def brushed_metal(name="Metal", color=(0.78, 0.78, 0.8), rough=0.3, aniso=0.6):
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos(scale=(1.0, 300.0, 300.0))
    n = k.node("ShaderNodeTexNoise", Scale=4.0, Detail=6.0)
    k.link(p, po, n, "Vector")
    r = k.ramp(n, "Fac", [(0.3, (rough * 0.8,) * 3), (0.7, (rough * 1.25,) * 3)])
    k.link(r, "Color", k.bsdf, "Roughness")
    k.set(**{"Base Color": (*color, 1), "Metallic": 1.0, "Anisotropic": aniso})
    return mat


def fabric(name="Fabric", color=(0.05, 0.055, 0.065), rough=0.95, weave=1800.0, sheen=0.4):
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    w = k.node("ShaderNodeTexWave", Scale=weave, Distortion=0.5, _wave_type="BANDS", _bands_direction="X")
    k.link(p, po, w, "Vector")
    w2 = k.node("ShaderNodeTexWave", Scale=weave, Distortion=0.5, _wave_type="BANDS", _bands_direction="Y")
    k.link(p, po, w2, "Vector")
    m = k.node("ShaderNodeMath", _operation="MULTIPLY")
    k.link(w, "Fac", m, 0)
    k.link(w2, "Fac", m, 1)
    big = k.node("ShaderNodeTexNoise", Scale=3.0, Detail=3.0)
    k.link(p, po, big, "Vector")
    tone = k.ramp(big, "Fac", [(0.3, tuple(c * 0.85 for c in color)), (0.7, tuple(c * 1.15 for c in color))])
    k.link(tone, "Color", k.bsdf, "Base Color")
    k.bump(m, 0, strength=0.15, distance=0.0008)
    k.set(Roughness=rough, **{"Sheen Weight": sheen, "Sheen Roughness": 0.4})
    return mat


def stone(name="Stone", color=(0.62, 0.6, 0.57)):
    """Speckled quartz counter."""
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    v = k.node("ShaderNodeTexVoronoi", Scale=180.0)
    k.link(p, po, v, "Vector")
    col = k.ramp(v, "Distance", [(0.0, tuple(c * 0.55 for c in color)), (0.12, color), (1.0, tuple(min(1, c * 1.08) for c in color))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.set(Roughness=0.22, **{"Coat Weight": 0.3, "Coat Roughness": 0.08})
    return mat


def concrete(name="Concrete", color=(0.3, 0.3, 0.29)):
    mat = _new(name)
    k = NodeKit(mat)
    p, po = k.pos()
    n = k.node("ShaderNodeTexNoise", Scale=6.0, Detail=10.0, Roughness=0.7)
    k.link(p, po, n, "Vector")
    col = k.ramp(n, "Fac", [(0.35, tuple(c * 0.8 for c in color)), (0.7, tuple(c * 1.15 for c in color))])
    k.link(col, "Color", k.bsdf, "Base Color")
    k.bump(n, "Fac", strength=0.15)
    k.set(Roughness=0.9)
    return mat


def glass(name="Glass", tint=(0.92, 0.96, 0.95), rough=0.0, thin=False):
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (*tint, 1), "Roughness": rough, "Transmission Weight": 1.0, "IOR": 1.5})
    if thin:
        mat.use_thin_walled = True if hasattr(mat, "use_thin_walled") else None
    return mat


def water(name="Water"):
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (0.95, 0.98, 1.0, 1), "Roughness": 0.0, "Transmission Weight": 1.0, "IOR": 1.333})
    return mat


def emission(name, color, strength, image=None):
    """Screens and LEDs. With `image`, the picture drives the emission colour."""
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (0.0, 0.0, 0.0, 1), "Roughness": 0.15, "Emission Strength": strength,
             "Emission Color": (*color, 1), "Coat Weight": 0.6, "Coat Roughness": 0.03})
    if image:
        tex = k.node("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(image), check_existing=True)
        mul = k.node("ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=1.0)
        k.link(tex, "Color", mul, 6)
        mul.inputs[7].default_value = (*color, 1)
        k.link(mul, 2, k.bsdf, "Emission Color")
    return mat


def image_mat(name, image, rough=0.6, emission_strength=0.0):
    """Printed things: book covers, photos, paper, clock face."""
    mat = _new(name)
    k = NodeKit(mat)
    tex = k.node("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(image), check_existing=True)
    k.link(tex, "Color", k.bsdf, "Base Color")
    if emission_strength:
        k.link(tex, "Color", k.bsdf, "Emission Color")
        k.set(**{"Emission Strength": emission_strength})
    k.set(Roughness=rough)
    return mat


def ceramic(name, color, rough=0.12):
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (*color, 1), "Roughness": rough, "Coat Weight": 0.5, "Coat Roughness": 0.05})
    return mat


def liquid_coffee(name="Coffee"):
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (0.035, 0.016, 0.006, 1), "Roughness": 0.05, "Coat Weight": 1.0, "Coat Roughness": 0.0,
             "Subsurface Weight": 0.2, "Subsurface Radius": (0.02, 0.01, 0.005)})
    return mat


def plastic(name, color, rough=0.4):
    mat = _new(name)
    k = NodeKit(mat)
    k.set(**{"Base Color": (*color, 1), "Roughness": rough})
    return mat


def restyle_shell():
    """Swap the grey-box shell materials (by name) for the real ones, in place."""
    table = {
        "Plaster": lambda: plaster(),
        "Ceiling": lambda: plaster("Ceiling", (0.62, 0.61, 0.58), 0.92),
        "Floor": lambda: oak_floor(),
        "Concrete": lambda: concrete(),
        "Trim": lambda: paint("Trim", (0.6, 0.58, 0.54), 0.35),
        "Door": lambda: paint("Door", (0.55, 0.53, 0.5), 0.4),
        "Window Frame": lambda: paint("Window Frame", (0.025, 0.025, 0.028), 0.35, coat=0.2),
        "Metal": lambda: brushed_metal(),
        "Glass": lambda: glass(),
        "Mirror": lambda: brushed_metal("Mirror", (0.95, 0.95, 0.95), 0.02, 0.0),
        "Diffuser": lambda: paint("Diffuser", (0.8, 0.79, 0.76), 0.5),
        "Furniture": lambda: walnut("Furniture", (0.16, 0.10, 0.06), (0.32, 0.21, 0.12)),
        "Fabric": lambda: fabric(),
        "Dark": lambda: paint("Dark", (0.018, 0.018, 0.02), 0.4),
        "White": lambda: paint("White", (0.72, 0.71, 0.68), 0.3, coat=0.2),
        "Stone": lambda: stone(),
    }
    for name, make in table.items():
        if name in bpy.data.materials:
            make()
