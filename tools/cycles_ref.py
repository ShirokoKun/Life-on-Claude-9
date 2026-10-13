"""Cycles ground-truth stills for the engine's shots (same cameras as engine/src/shots.js, mid-shot).

    python -I tools/cycles_ref.py <room_lit.blend> <ivan.blend> <out_prefix> [--shots S1,S3] [--samples 32] [--res 960x480]
"""
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
room, ivan, out = a[0], a[1], a[2]
opt = lambda k, d: a[a.index(k) + 1] if k in a else d
want = opt("--shots", "S1,S2,S3,S4,S5").split(",")
W, H = (int(v) for v in opt("--res", "960x480").split("x"))

src = (Path(__file__).resolve().parent.parent / "engine/src/shots.js").read_text()
shots = {}
for m in re.finditer(r"\{ id: '(S\d)'.*?why:", src, re.S):
    body = m.group(0)
    g = lambda k: json.loads(re.search(k + r": (\[[^\]]*\])", body).group(1))
    t0, t1 = (float(x) for x in re.search(r"t0: ([\d.]+), t1: ([\d.]+)", body).groups())
    shots[m.group(1)] = dict(t0=t0, t1=t1, mm=g("mm"), frm=g("from"), to=g("to"), at0=g("at0"), at1=g("at1"),
                             f=float(re.search(r"f: ([\d.]+)", body).group(1)))

bpy.ops.wm.open_mainfile(filepath=room)
with bpy.data.libraries.load(ivan) as (s, d):
    d.objects = list(s.objects)
for o in d.objects:
    if o:
        bpy.context.scene.collection.objects.link(o)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(opt("--samples", "32"))
sc.cycles.use_denoising = True; sc.render.use_compositing = False
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "8"
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"; sc.view_settings.exposure = 1.35
for k in want:
    s = shots[k]; u = 0.5; t = 0.5 * (s["t0"] + s["t1"])
    sc.frame_set(int(t * 24) + 1)
    lerp = lambda p, q: Vector(p).lerp(Vector(q), u)
    pos, at = lerp(s["frm"], s["to"]), lerp(s["at0"], s["at1"])
    cd = bpy.data.cameras.new(k); cd.lens = s["mm"][0] + (s["mm"][1] - s["mm"][0]) * u; cd.sensor_width = 36; cd.clip_start = 0.03
    cd.dof.use_dof = True; cd.dof.aperture_fstop = s["f"] / 1.6; cd.dof.focus_distance = (Vector(at) - pos).length
    cam = bpy.data.objects.new(k, cd); sc.collection.objects.link(cam)
    cam.location = pos; cam.rotation_euler = (at - pos).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam; sc.render.filepath = f"{out}_{k}.png"
    bpy.ops.render.render(write_still=True)
    print("REF", k, flush=True)
