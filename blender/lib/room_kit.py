"""Modelling kit for photoreal interiors in Cycles (the tutorial's method: scripted hard surface, real bevels,
PBR materials with wear, Poly Haven assets where they are better than anything we'd model).

Every builder takes real metres, returns objects, and bevels its edges (a sharp CG edge is the first thing that
reads fake: real objects catch a thin highlight on every edge).
"""
import bpy, bmesh, math, os, glob, random
from mathutils import Vector, Euler, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PROPS = os.path.join(ROOT, 'blender', 'assets', 'props')
TEX = os.path.join(ROOT, 'engine', 'assets', 'tex')          # CC0 sets shared with the engine (albedo/normal/rough[/ao])
D = bpy.data

# ---------------------------------------------------------------- collections
_COLL = {}
def coll(name, parent=None):
    if name not in _COLL:
        c = D.collections.new(name); (parent or bpy.context.scene.collection).children.link(c); _COLL[name] = c
    return _COLL[name]

def link(o, c='set'):
    for x in list(o.users_collection): x.objects.unlink(o)
    coll(c).objects.link(o); return o

# ---------------------------------------------------------------- materials
def _nodes(m):
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bs.outputs[0], out.inputs[0]); return nt, bs, out

def mat_plain(name, color, rough=0.5, metal=0.0, coat=0.0, spec=0.5, bump=None, bump_scale=40.0, transmission=0.0, ior=1.45, alpha=1.0):
    """A solid material with optional micro-surface (noise bump): paint, plastics, powder coat, ceramic."""
    if name in D.materials: return D.materials[name]
    m = D.materials.new(name); nt, bs, out = _nodes(m)
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal; bs.inputs['Coat Weight'].default_value = coat
    bs.inputs['Specular IOR Level'].default_value = spec; bs.inputs['Transmission Weight'].default_value = transmission
    bs.inputs['IOR'].default_value = ior; bs.inputs['Alpha'].default_value = alpha
    if bump:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = bump_scale; nz.inputs['Detail'].default_value = 8
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.002
        nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], bs.inputs['Normal'])
        # roughness breaks up with the same noise (smudges, wear)
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = rough * 0.8; mr.inputs['To Max'].default_value = min(1, rough * 1.25)
        nt.links.new(nz.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs[0], bs.inputs['Roughness'])
    return m

def mat_tex(name, tex_key, tile=1.0, tint=(1, 1, 1), rough_mul=1.0, rough_add=0.0, normal=1.0, metal=0.0, coat=0.0, folder=None, rot=0.0, coords='Object'):
    """A PBR set mapped in metres (box projection on object coordinates, so scale never stretches)."""
    if name in D.materials: return D.materials[name]
    m = D.materials.new(name); nt, bs, out = _nodes(m); N = nt.nodes; L = nt.links
    f = folder or os.path.join(TEX, tex_key)
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile,) * 3
    mp.inputs['Rotation'].default_value = (0, 0, math.radians(rot)); L.new(tc.outputs[coords], mp.inputs[0])
    def img(fn, color):
        p = os.path.join(f, fn)
        if not os.path.exists(p): return None
        t = N.new('ShaderNodeTexImage'); t.image = D.images.load(p, check_existing=True); t.projection = 'BOX'; t.projection_blend = 0.2
        if not color: t.image.colorspace_settings.name = 'Non-Color'
        L.new(mp.outputs[0], t.inputs[0]); return t
    a = img('albedo.jpg', True); r = img('rough.jpg', False); n = img('normal.jpg', False); ao = img('ao.jpg', False)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    L.new(a.outputs[0], mix.inputs['A']); mix.inputs['B'].default_value = (*tint, 1)
    col = mix.outputs['Result']
    if ao:
        m2 = N.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 0.8
        L.new(col, m2.inputs['A']); L.new(ao.outputs[0], m2.inputs['B']); col = m2.outputs['Result']
    L.new(col, bs.inputs['Base Color'])
    if r:
        mr = N.new('ShaderNodeMath'); mr.operation = 'MULTIPLY_ADD'; mr.inputs[1].default_value = rough_mul; mr.inputs[2].default_value = rough_add
        L.new(r.outputs[0], mr.inputs[0]); L.new(mr.outputs[0], bs.inputs['Roughness'])
    if n:
        nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal; L.new(n.outputs[0], nm.inputs['Color']); L.new(nm.outputs[0], bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value = metal; bs.inputs['Coat Weight'].default_value = coat
    return m

def mat_emit(name, color, strength):
    if name in D.materials: return D.materials[name]
    m = D.materials.new(name); m.use_nodes = True; N = m.node_tree.nodes; N.clear()
    e = N.new('ShaderNodeEmission'); e.inputs[0].default_value = (*color, 1); e.inputs[1].default_value = strength
    o = N.new('ShaderNodeOutputMaterial'); m.node_tree.links.new(e.outputs[0], o.inputs[0]); return m

def mat_image_emit(name, path, strength=1.0):
    """A screen: an image as emission (+ a faint glossy glass on top)."""
    if name in D.materials: return D.materials[name]
    m = D.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; N.clear()
    t = N.new('ShaderNodeTexImage'); t.image = D.images.load(path, check_existing=True)
    e = N.new('ShaderNodeEmission'); e.inputs[1].default_value = strength; nt.links.new(t.outputs[0], e.inputs[0])
    g = N.new('ShaderNodeBsdfGlossy'); g.inputs['Roughness'].default_value = 0.08
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.08
    add = N.new('ShaderNodeMixShader'); nt.links.new(lw.outputs['Fresnel'], add.inputs[0]); nt.links.new(e.outputs[0], add.inputs[1]); nt.links.new(g.outputs[0], add.inputs[2])
    o = N.new('ShaderNodeOutputMaterial'); nt.links.new(add.outputs[0], o.inputs[0]); return m

def arch_glass(m):
    """Arch-viz glass: real glass for camera and reflection rays, plain transparency for light paths, so daylight
    through windows is direct light (not a caustic) and the room fills properly."""
    nt = m.node_tree; N = nt.nodes; L = nt.links; out = [n for n in N if n.type == 'OUTPUT_MATERIAL'][0]
    surf = out.inputs['Surface'].links[0].from_socket
    lp = N.new('ShaderNodeLightPath'); tr = N.new('ShaderNodeBsdfTransparent'); tr.inputs[0].default_value = (0.92, 0.95, 0.94, 1)
    mx_ = N.new('ShaderNodeMath'); mx_.operation = 'MAXIMUM'; L.new(lp.outputs['Is Camera Ray'], mx_.inputs[0]); L.new(lp.outputs['Is Glossy Ray'], mx_.inputs[1])
    mix = N.new('ShaderNodeMixShader'); L.new(mx_.outputs[0], mix.inputs[0]); L.new(tr.outputs[0], mix.inputs[1]); L.new(surf, mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface']); return m

def mat_glass(name, rough=0.0, tint=(0.95, 0.98, 0.97)):
    if name in D.materials: return D.materials[name]
    return arch_glass(mat_plain(name, tint, rough=rough, transmission=1.0, ior=1.5, spec=0.5))

def mat_wireglass(name):
    """Frosted wired glass (the lower window panels): translucent, with a 25 mm square wire grid."""
    if name in D.materials: return D.materials[name]
    m = D.materials.new(name); nt, bs, out = _nodes(m); N = nt.nodes; L = nt.links
    bs.inputs['Base Color'].default_value = (0.9, 0.93, 0.92, 1); bs.inputs['Transmission Weight'].default_value = 1.0
    bs.inputs['Roughness'].default_value = 0.45; bs.inputs['IOR'].default_value = 1.5
    tc = N.new('ShaderNodeTexCoord'); br = N.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.004; br.inputs['Brick Width'].default_value = 0.025; br.inputs['Row Height'].default_value = 0.025
    br.offset = 0.0; br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (1, 1, 1, 1); br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    sep = N.new('ShaderNodeVectorMath'); sep.operation = 'MULTIPLY'; sep.inputs[1].default_value = (1, 1, 1)
    L.new(tc.outputs['Object'], br.inputs['Vector'])
    wire = N.new('ShaderNodeBsdfPrincipled'); wire.inputs['Base Color'].default_value = (0.05, 0.05, 0.05, 1); wire.inputs['Metallic'].default_value = 1; wire.inputs['Roughness'].default_value = 0.4
    mx = N.new('ShaderNodeMixShader'); L.new(br.outputs['Fac'], mx.inputs[0]); L.new(wire.outputs[0], mx.inputs[1]); L.new(bs.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs[0]); return arch_glass(m)

def mat_leather(name='leather_black'):
    """Black leather: low roughness, the CC0 leather grain, plus large soft creases where it's been sat in."""
    if name in D.materials: return D.materials[name]
    m = mat_tex(name, 'leather', tile=0.35, tint=(0.05, 0.05, 0.055), rough_mul=0.45, rough_add=0.18, normal=0.9)
    nt = m.node_tree; N = nt.nodes; L = nt.links; bs = N['Principled BSDF']
    bs.inputs['Coat Weight'].default_value = 0.15; bs.inputs['Coat Roughness'].default_value = 0.35
    # creases: stretched noise -> bump, added to the grain normal
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 3; nz.inputs['Distortion'].default_value = 2.5
    tc = N.new('ShaderNodeTexCoord'); L.new(tc.outputs['Object'], nz.inputs['Vector'])
    b = N.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.35; b.inputs['Distance'].default_value = 0.01
    L.new(nz.outputs['Fac'], b.inputs['Height'])
    nmap = [n for n in N if n.type == 'NORMAL_MAP'][0]; L.new(nmap.outputs[0], b.inputs['Normal']); L.new(b.outputs[0], bs.inputs['Normal'])
    return m

# ---------------------------------------------------------------- geometry
def bevel(o, w=0.003, seg=2, limit=30):
    md = o.modifiers.new('bevel', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(limit)
    md.harden_normals = True; o.data.shade_smooth() if hasattr(o.data, 'shade_smooth') else None
    return o

def cube(name, size, loc, mat=None, bev=0.003, seg=2, rot=(0, 0, 0), c='set'):
    """A bevelled box of real size (metres), centred at loc."""
    me = D.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(me); bm.free()
    o = D.objects.new(name, me); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot]); link(o, c)
    if mat: me.materials.append(mat)
    if bev: bevel(o, bev, seg)
    return o

def cyl(name, r, h, loc, mat=None, seg=32, rot=(0, 0, 0), bev=0.002, c='set', r2=None):
    me = D.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r2 if r2 is not None else r, depth=h)
    bm.to_mesh(me); bm.free()
    o = D.objects.new(name, me); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot]); link(o, c)
    if mat: me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    if bev: bevel(o, bev, 2, 50)
    return o

def lathe(name, profile, loc, mat=None, seg=48, c='set', rot=(0, 0, 0)):
    """profile: [(radius, z), ...] bottom to top; a surface of revolution (mugs, cups, bottles, lamp shades)."""
    me = D.meshes.new(name); bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    bm.to_mesh(me); bm.free()
    o = D.objects.new(name, me); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot]); link(o, c)
    if mat: me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    return o

def subsurf(o, lv=2):
    md = o.modifiers.new('sub', 'SUBSURF'); md.levels = lv; md.render_levels = lv
    for p in o.data.polygons: p.use_smooth = True
    return o

def tube(name, pts, r, mat=None, c='set', res=8):
    """A tube along points (cables, chair arms, lamp necks)."""
    cu = D.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3; cu.resolution_u = res
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co; p.handle_left_type = p.handle_right_type = 'AUTO'
    o = D.objects.new(name, cu); link(o, c)
    if mat: cu.materials.append(mat)
    return o

# ---------------------------------------------------------------- Poly Haven assets
_lib = {}
def asset(asset_id, loc, rz=0.0, scale=1.0, skip=(), only=None, c='set', rx=0.0, ry=0.0, mat=None):
    """Instance a Poly Haven glTF (imported once, then linked duplicates that share the meshes)."""
    if asset_id not in _lib:
        before = set(D.objects)
        bpy.ops.import_scene.gltf(filepath=glob.glob(os.path.join(PROPS, asset_id, '*.gltf'))[0])
        new = [o for o in D.objects if o not in before]
        for o in new: link(o, '_lib')
        coll('_lib').hide_render = True; coll('_lib').hide_viewport = True
        _lib[asset_id] = [o for o in new if o.type == 'MESH']
    out = []
    base = Matrix.Translation(Vector(loc)) @ Euler((math.radians(rx), math.radians(ry), math.radians(rz))).to_matrix().to_4x4() @ Matrix.Diagonal((scale, scale, scale, 1))
    for src in _lib[asset_id]:
        n = src.name.split('.')[0]
        if any(s in n for s in skip) or (only and not any(s in n for s in only)): continue
        o = D.objects.new(n, src.data); o.matrix_world = base @ src.matrix_world; link(o, c); out.append(o)
        if mat:   # recolour this instance only (object-level material slots)
            for sl in o.material_slots: sl.link = 'OBJECT'; sl.material = mat
    return out

def kelvin(k):
    t = k / 100.0
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.04)
    return tuple((max(0, min(255, x)) / 255.0) ** 2.2 for x in (r, g, b))

def lamp(kind, name, loc, energy, color, rot=(0, 0, 0), size=0.1, spot=None, blend=0.3, c='lights'):
    l = D.lights.new(name, kind); l.energy = energy; l.color = color
    if kind == 'AREA':
        l.shape = 'RECTANGLE'; l.size, l.size_y = size if isinstance(size, tuple) else (size, size)
    elif kind in ('POINT', 'SPOT'): l.shadow_soft_size = size
    elif kind == 'SUN': l.angle = math.radians(size)
    if kind == 'SPOT': l.spot_size = math.radians(spot or 70); l.spot_blend = blend
    o = D.objects.new(name, l); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot]); link(o, c); return o
